const gulp = require("gulp");
const del = require("del");
const ts = require("gulp-typescript");
const tslint = require("gulp-tslint");
const sourcemaps = require("gulp-sourcemaps");
const shell = require("gulp-shell");
const awspublish = require("gulp-awspublish");
const rename = require("gulp-rename");

// Testing

const BUCKET_NAME = "drone-test-results";
const BUCKET_ENDPOINT = "https://cloud.neocodenetworks.org";
const WEBSITE_ENDPOINT = "https://cloud-website.neocodenetworks.org";

const publisher = awspublish.create({
    "endpoint": BUCKET_ENDPOINT,
    "region": "us-east-1",
    "s3ForcePathStyle": true,
    "signatureVersion": "v2",
    "params": {
        "Bucket": BUCKET_NAME
    }
});

function getBranch() {
    return process.env.DRONE_BRANCH || "localdevnobranch";
}

function getS3path(pathname) {
    return `mue-server/${getBranch()}/${pathname}/`;
}

gulp.task("test:clean", () => {
    return del(["coverage", "mochawesome-report"]);
})

gulp.task("test", shell.task("nyc mocha", {"env": {"NODE_ENV": "test"}}));

gulp.task("test:upload:report", () => {
    return gulp.src("mochawesome-report/**")
        .pipe(rename((path) => {
            path.dirname = getS3path("report") + path.dirname;
        }))
        .pipe(publisher.publish())
        .pipe(publisher.sync(getS3path("report")))
        .pipe(awspublish.reporter({"states": ["create", "update", "delete"]}));
});

gulp.task("test:upload:coverage", () => {
    return gulp.src("coverage/**")
        .pipe(rename((path) => {
            path.dirname = getS3path("coverage") + path.dirname;
        }))
        .pipe(publisher.publish())
        .pipe(publisher.sync(getS3path("coverage")))
        .pipe(awspublish.reporter({"states": ["create", "update", "delete"]}));
});

gulp.task("test:upload", ["test:upload:report", "test:upload:coverage"], () => {
    const url = `${WEBSITE_ENDPOINT}/${BUCKET_NAME}`;

    console.log(`Test report available at ${url}/${getS3path("report")}mochawesome.html`);
    console.log(`Test coverage available at ${url}/${getS3path("coverage")}index.html`);
});

// Code

const tsProject = ts.createProject("tsconfig.json");

gulp.task("ts:clean", () => {
    return del("build");
});

gulp.task("ts:lint", () => {
    return tsProject.src()
        .pipe(tslint({
            "configuration": "tslint.json"
        }))
        .pipe(tslint.report());
});

gulp.task("ts:compile", ["ts:clean"], () => {
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
