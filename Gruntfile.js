function loadConfig(path) {
  var string = require('string');
  var glob = require('glob');
  var object = {};
  var key;

  glob.sync('*', { cwd: path }).forEach(function(option) {
    key = option.replace(/\.js$/,'');
    key = string(key).camelize().s;
    object[key] = require(path + option);
  });

  return object;
}

module.exports = function(grunt) {
  var config = {
    pkg: grunt.file.readJSON('package.json'),
    env: process.env,
    clean: ['tmp']
  };

  grunt.util._.extend(config, loadConfig('./tasks/options/'));

  grunt.initConfig(config);

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
  grunt.loadTasks('tasks');

  grunt.registerTask('default', ['build']);
  grunt.registerTask('build',   [
                     'lock',
                     'clean',
                     'transpile',
                     'jshint',
                     'copy',
                     'emberTemplates:compile',
                     'sass:compile',
                     'concat',
                     'unlock' ]);

  grunt.registerTask('test',    ['build',  'qunit']);
  grunt.registerTask('server',  ['build', 'connect', 'watch']);
}; 
