var DashboardController = Ember.Controller.extend({
  needs: ['user'],
  myBugs: Ember.computed.alias('controllers.user.bugs')
});

export = DashboardController;
