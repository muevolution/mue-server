const gulp = require("gulp");
const del = require("del");
const ts = require("gulp-typescript");
const tslint = require("gulp-tslint");
const sourcemaps = require("gulp-sourcemaps");

gulp.task("clean", () => {
    return del("build");
});

gulp.task("ts:lint", () => {
    const tsProject = ts.createProject("tsconfig.json");
    return tsProject.src()
        .pipe(tslint({
            "configuration": "tslint.json"
        }))
        .pipe(tslint.report());
});

gulp.task("ts:compile", ["clean"], () => {
    const tsProject = ts.createProject("tsconfig.json");
    const tsResult = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject());

    return tsResult.js.pipe(sourcemaps.write()).pipe(gulp.dest("build"));
});

gulp.task("build", ["ts:compile"]);

gulp.task("watch", ["build"], () => {
    gulp.watch("src/**/*.ts", ["build"]);
});

gulp.task("default", ["ts:lint", "build"]);
