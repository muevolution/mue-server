const gulp = require("gulp");
const del = require("del");
const ts = require("gulp-typescript");
const tslint = require("gulp-tslint");
const sourcemaps = require("gulp-sourcemaps");

const tsProject = ts.createProject("tsconfig.json");

gulp.task("clean", () => {
    return del("build");
});

gulp.task("ts:lint", () => {
    return tsProject.src()
        .pipe(tslint({
            "configuration": "tslint.json"
        }))
        .pipe(tslint.report());
});

gulp.task("ts:compile", ["clean"], () => {
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .pipe(sourcemaps.write({sourceRoot: "./", includeContent: false}))
        .pipe(gulp.dest("build"));
});

gulp.task("build", ["ts:compile"]);

gulp.task("watch", ["build"], () => {
    gulp.watch("src/**/*.ts", ["build"]);
});

gulp.task("default", ["ts:lint", "build"]);
