'use strict';

var gulp = require('gulp');
var devServer = require('gulp-develop-server'); //gulp插件，自动启动node和重启
var notify = require('gulp-notify');

gulp.task('serve', (done) => {
    devServer.listen({
        path: './index.js'
    });
    done();
});
gulp.task('restart', (done) => {
    devServer.restart();
    done();
});

//创建个任务，用于信息提醒
gulp.task('notify', () => gulp.src('./index.js').pipe(notify('服务重启成功！')));
//监视整个项目（忽略项目下gulpfile.js和package.json文件）
gulp.task('watch', () => {
    return gulp.watch(['./**/*', '!./gulpfile.js', '!./package.json','!./notes.txt'], gulp.series('restart','notify'));
});

gulp.task('default', gulp.series('serve', 'watch'));