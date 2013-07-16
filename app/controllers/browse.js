import 'bugzilla/models/bug' as Bug;

var BrowseController = Ember.ArrayController.extend({
  products: null,
  selectedProduct: null,

  components: Em.computed.alias('selectedProduct.components'),
  selectedComponent: null,

  content: function() {
    return Bug.find({
      product: this.get('selectedProduct.name'),
      component: this.get('selectedComponent.name')
    });
  }.property('selectedComponent'),

  init: function(){
    this._super();
    this.set('sortProperties', ['last_change_time']);
    this.set('sortAscending', false);
  },

  changeSort: function(property) {
    if (this.get('sortProperties').contains(property)) {
      var newSortDirection = this.get('sortAscending') ? false : true;
      this.set('sortAscending', newSortDirection);
    } else {
      this.set('sortProperties', [property]);
    }
  }
});

export = BrowseController;
