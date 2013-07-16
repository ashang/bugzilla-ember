import 'bugzilla/models/comment' as Comment;
import 'bugzilla/models/attachment' as Attachment;

import 'bugzilla/utils/get_json'  as getJSON;
import 'bugzilla/utils/url_for'   as urlFor;
import 'bugzilla/utils/promise_storage'  as promiseStorage;

// TODO: remove app dependency
import 'bugzilla/app' as App;

var attr = Ember.attr, hasMany = Ember.hasMany;

var Bug = App.Bug = Ember.Model.extend({
  id: attr(),
  alias: attr(),
  status: attr(),
  summary: attr(),
  keywords: attr(),
  product: attr(),
  component: attr(),
  version: attr(),
  platform: attr(),
  op_sys: attr(),
  priority: attr(),
  severity: attr(),
  assigned_to: attr(),
  qa_contact: attr(),
  url: attr(),
  // FIXME: can't do self-referential relationships in the body of the model definition
  depends_on: hasMany("App.Bug", {key: 'depends_on'}),
  blocks: hasMany("App.Bug", {key: 'blocks'}),
  creator: attr(), // aka reporter
  creation_time: attr(Date),
  last_change_time: attr(Date),
  cc: attr(),
  flags: attr(),
  attachments: attr(),

  aliasOrId: function() {
    return this.get('alias') || this.get('id');
  }.property('alias', 'id'),

  isResolved: function() {
    return this.get('status') === "RESOLVED";
  }.property('status'),

  unobsoleteAttachments: function() {
    var attachments = this.get('attachments');

    if (!attachments) { return []; }

    return attachments.filter(function(attachment) {
      return !attachment.is_obsolete;
    }).map(function(attachment) {
      var record = Attachment.create({data: attachment, isLoaded: true});
      record.then = null; // FIXME: We need to get rid of records-as-promises :(
      return record;
    });
  }.property('attachments.@each.is_obsolete'),

  // TODO: figure out how to make comments a legit relationship
  comments: function() {
    return Comment.find({bug_id: this.get('id')});
  }.property(),

  firstComment: function() {
    if (!this.get('comments.isLoaded')) { return; }

    return this.get('comments.firstObject');
  }.property('comments.isLoaded'),

  remainingComments: function() {
    if (!this.get('comments.isLoaded')) { return; }

    return this.get('comments').slice(1);
  }.property('comments.isLoaded', 'comments.[]'),

  init: function() {
    this._super();

    // add records to search index
    this.on('didLoad', function() {
      this.constructor.index.add(this.attributesForIndex());
    });
  },

  attributesForIndex: function() {
    var attrs = this.getProperties('summary');
    attrs.id = this.get('id').toString(); // lunr doesn't like numbers :/
    return attrs;
  },

  reload: function() {
    this._super();

    // Check for new comments. TODO: This can be made cleaner.
    var existingComments = this.get('comments'),
        latestComments = Comment.find({bug_id: this.get('id')});

    latestComments.forEach(function(comment) {
      if (!existingComments.contains(comment)) {
        existingComments.pushObject(comment);
      }
    });
  }
});

Bug.reopenClass({
  index: lunr(function() {
    this.field('summary', {boost: 10});
    this.field('id');
    this.ref('id');
  }),

  search: function(text) {
    return this.index.search(text).map(function(result) {
      result.record = Bug.find(result.ref);
      return result;
    });
  },

  adapter: Ember.Adapter.create({
    _getJSON: function(id, params) {
      return getJSON(urlFor("bug" + (id ? "/" + id : "")), params);
    },

    _loadFromServer: function(record, id) {
      this._getJSON(id).then(function(json) {
        var data = json.bugs[0];
        record.load(id, data);
        asyncStorage.setItem('bug-' + id, data);
      });
    },

    find: function(record, id) {
      var self = this;

      return promiseStorage.getItem('bug-' + id).then(function(value){
        if (value !== null) {
          record.load(id, value);

          return self._getJSON(id, {include_fields: "last_change_time"}).then(function(json) {
            if (json.bugs[0].last_change_time !== value.last_change_time) {
              self._loadFromServer(record, id);
            }
          });

        } else {
          return self._loadFromServer(record, id);
        }
      }).then(null, Ember.unhandledRejection);
    },

    findMany: function(klass, records, ids) {
      return this._getJSON("", {id: ids.join(',')}).then(function(data) {
        records.load(klass, data.bugs);
      });
    },

    findQuery: function(klass, records, params) {
      this._getJSON("", params).then(function(data) {
        records.load(klass, data.bugs);
      });
    }
  })
});

export = Bug;
