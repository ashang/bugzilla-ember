import Bug from "bugzilla/models/bug";
import Comment from 'bugzilla/models/comment';
import Attachment from 'bugzilla/models/attachment';
import unhandledRejection from 'bugzilla/utils/unhandled_rejection';
import ajax from "bugzilla/utils/ajax";
import urlFor from "bugzilla/utils/url_for";

var BugController = Ember.ObjectController.extend({
  needs: ['user', 'bug'],
  user: Em.computed.alias('controllers.user'),
  canEdit: Ember.computed.and('model.canEdit', 'user.isLoggedIn'),
  isLoaded: Ember.computed.bool('model'),
  isLoading: Ember.computed.not('isLoaded'),
  isEditing: null,
  showingObsoleteAttachments: false,
  isShowingRemainingComments: false,
  newCommentText: null,
  flashMessage: null,

  findBug: function(bugId) {
    var self = this;

    Bug.find(bugId).then(function(bug) {
      self.set('model', bug);
      document.title = bug.get('id') + ' - ' + bug.get('fields.summary.current_value');
    }, function(reason) {
      alert('An error occurred while loading bug #' + bugId);
      console.log(reason);
    });
  },

  oldUIURL: function() {
    return this.get('config.host') + '/show_bug.cgi?id=' + this.get('id');
  }.property('id', 'config.host'),

  keywords: function() {
    var keywords = this.get('content.keywords');
    return keywords && keywords.join(', ');
  }.property('content.keywords'),

  currentUserInCCList: function() {
    var email = this.get('user.username'),
        ccList = this.get('fields.cc.current_value');

    return ccList.contains(email);
  }.property('user.username', 'fields.cc.current_value.[]'),

  isResolved: function() {
    return this.get('fields.status.current_value') === 'RESOLVED';
  }.property('fields.status.current_value'),

  filteredAttachments: function() {
    var attachments = this.get('attachments');

    var filter = this.get('showingObsoleteAttachments') ? Ember.K : isntObsolete;
    var result = attachments.filter(filter).map(toAttachment);

    Ember.set(result, '_source', attachments);
    Ember.defineProperty(result, 'isLoading', Ember.computed.alias('_source.isLoading'));

    return result;

    function isntObsolete(attachment) {
      return !attachment.is_obsolete;
    }

    function toAttachment(data) {
      return Attachment.create({
        _data: data,
        isLoaded: true
      });
    }
  }.property('attachments.@each.is_obsolete', 'showingObsoleteAttachments'),

  actions: {
    save: function() {
      var self = this,
          bug = this.get('model');

      bug.update().then(function(model) {
        self.set('flashMessage', null);
        self.transitionToRoute('bug');
      }, function(reason) {
        // FIXME: unify error handling

        var json = reason.responseJSON;
        if (json && json.message) {
          self.set('flashMessage', json.message);
        } else {
          alert("Error occurred while saving bug");
          console.log(reason);
        }
      });
    },

    addCurrentUserToCCList: function() {
      var self = this,
          currentUserEmail = this.get('user.username');

      ajax(urlFor("bug/" + this.get('id')), {
        type: "PUT",
        dataType: "json",
        contentType: "application/json",
        data: JSON.stringify({cc: {add: [currentUserEmail]}})
      }).then(function(json) {
        self.get("fields.cc.current_value").pushObject(currentUserEmail);
      }, function(reason) {
        alert("Error occurred, see console");
        console.log(reason);
      });
    },

    removeCurrentUserFromCCList: function() {
      var self = this,
          currentUserEmail = this.get('user.username');

      ajax(urlFor("bug/" + this.get('id')), {
        type: "PUT",
        dataType: "json",
        contentType: "application/json",
        data: JSON.stringify({cc: {remove: [currentUserEmail]}})
      }).then(function(json) {
        self.get("fields.cc.current_value").removeObject(currentUserEmail);
      }, function(reason) {
        alert("Error occurred, see console");
        console.log(reason);
      });
    },

    toggleObsoleteAttachments: function() {
      this.toggleProperty('showingObsoleteAttachments');
    },

    showRemainingComments: function() {
      this.set('isShowingRemainingComments', true);
    },

    saveComment: function() {
      var newComment = Comment.create({
        text: this.get('newCommentText'),
        bug_id: this.get('id')
      });

      var self = this;
      newComment.save().then(function() {
        // FIXME: Comments is an array of POJOs initially. We push a Comment object when created on the client.
        self.get('comments').pushObject(newComment);
        self.set('newCommentText', null);
      }).then(null, unhandledRejection);
    },

    reply: function(comment) {
      var newCommentText = this.get('newCommentText') || "",
          commentIndex = this.get('comments').indexOf(comment);

      newCommentText += "(In reply to %@ from comment #%@)\n".fmt(Ember.get(comment, 'creator'), commentIndex);
      newCommentText += Ember.get(comment, "text").replace(/^/m, "> ");
      newCommentText += "\n\n";

      this.set('newCommentText', newCommentText);
    }
  },

  _pollingInterval: 30 * 1000,
  _pollingTimer: null,

  _startPolling: function() {
    if (Ember.testing || this._pollingTimer) { return; }

    // this._pollingTimer = Ember.run.later(this, function() {
    //   var content = this.get('content');
    //   content.reload();
    //   this._pollingTimer = null;
    //   this._startPolling();
    // }, this._pollingInterval);
  },

  _stopPolling: function() {
    if (this._pollingTimer) {
      Ember.run.cancel(this._pollingTimer);
      this._pollingTimer = null;
    }
  },

  init: function() {
    this._visibility = new Visibility({
      onHidden: this._stopPolling.bind(this),
      onVisible: this._startPolling.bind(this)
    });
  },

  willDestroy: function() {
    this._visibility.destroy();
  },

  _contentWillChange: function() {
    this._stopPolling();
  }.observesBefore('content'),

  _contentDidChange: function() {
    this._startPolling();
    this.set('flashMessage', null);
  }.observes('content')
});

export default BugController;