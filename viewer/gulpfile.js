var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var vueify = require('vueify');

function compile(watch) {
  var extensions = ['.es6', '.js', '.json', '.vue'];
  var presets = ['es2015'];
  var plugins = ['transform-runtime'];

  var bundler = watchify(browserify('static/js/es6/app.es6', {
    debug: true,
    extensions,
    cache: {},
    packageCache: {},
  }));

  function rebundle() {
    bundler.bundle()
      .on('error', function(err) { console.error(err); this.emit('end'); })
      .pipe(source('app.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./static/build'));
  }

  if (watch) {
    bundler.on('update', function() {
      console.log(timestamp() + '-> bundling...');
      rebundle();
    });
  }

  rebundle();
}

function timestamp() {
  var date = new Date();
  var hours = (date.getHours() < 10 ? '0' : '') + date.getHours();
  var minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
  var seconds = (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
  var dateString = '[' + hours + ':' + minutes + ':' + seconds + '] ';
  return dateString;
};

function watch() {
  return compile(true);
};

gulp.task('build', function() { return compile(); });
gulp.task('watch', function() { return watch(); });

gulp.task('default', ['watch']);
