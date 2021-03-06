/**
 * Copyright 2014 IBM Corp.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var htmlProducerFactory = require("./htmlProducer");
var url = require("url");
var path = require("path");
var fs = require("fs");
var screenies = require("./screenies");
var utils = require("./utils");
var w3c = require('w3c-validate').createValidator();
var http = require('http');

var logger = utils.createLogger({sourceFilePath : __filename});

function ProjectCommands(args) {
    var composer, project, runtime;
    var runningScreenshotsGen = false;
    var runningValidation = false;

    var createHtmlProducer = function () {
        return htmlProducerFactory.createHtmlProducer({
            runtime:runtime
        });
    };

    var commandFactory = {
        "list-all": function (request, response, project) {
            var files = project.listAllTemplatePaths();
            var hp = createHtmlProducer();
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "list-compiled": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "generate-compiled-nav": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createBareListingEntriesMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "list-referencing": function (request, response, project) {
            var files = project.listPathsWithReferences();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "list-referencing-bare": function (request, response, project) {
            var files = project.listPathsWithReferences();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createBareListingEntriesMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "list-referenced": function (request, response, project) {
            var files = project.listAllReferencedPaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "list": function (request, response, project) {
            var files = project.listAllTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "compile_all": function (request, response, project) {
            var files = project.listAllTemplatePaths();
            files.forEach(function (filePath) {
                var fileContents = runtime.readFile(filePath);
                var fileName = path.basename(filePath);
                try{
                    var composed = composer.composeTemplate(filePath, fileContents);
                    var responsePath = path.dirname(filePath) + "/" + fileName.substring(0, fileName.lastIndexOf('.')) + '-compiled.html';
                    runtime.writeFile(responsePath, composed.content);
                    logger.info("Wrote compiled version to " + responsePath);
                }catch(CompilationError){
                    logger.error("Could not compile " + fileName + " with contents: " + fileContents);
                    console.trace(CompilationError);
                    logger.warn("Skipping " + fileName + " from back compilation.");
                }
            });
            var hp = createHtmlProducer(project);
            var out = hp.createCompiledMarkup(files) + project.readViewScriptsMarkup();
            project.updateDynamic();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "delete_compiled": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.forEach(function (fd) {
                var filePath = fd;
                runtime.deleteFile(filePath);
                logger.info("Deleted compiled file : " + filePath);
            });
            project.updateDynamic();
            var hp = createHtmlProducer(project);
            var out = hp.createDeletedMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html"
                },
                content: out
            };
        },
        "generate-components-page": function (request, response, project) {
            var url_parts = url.parse(request.url, true);
            var componentDirsTxt = url_parts.query.componentDirs || false;
            if (!componentDirsTxt) {
                logger.error("No componentDirs argument passed= " + request.url);
                return {
                    status: 406,
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    content: "Missing componentDirs request argument, eg. componentDirs=components,portlets"
                };
            } else {
                var dirs = [componentDirsTxt];
                if (componentDirsTxt.indexOf(',') > 0) {
                    dirs = componentDirsTxt.split(',');
                }
                var paths = [];
                dirs.forEach(function (dir) {
                    var pd = project.resolveProjectFile(dir);
                    var templatePaths = project.listProjectTemplatePaths(pd);
                    templatePaths.forEach(function (tp) {
                        paths.push(tp);
                    });
                });
                paths.sort();
                var parentDivClasses = url_parts.query.parentDivClasses || "col-md-6";
                var out = "";
                paths.forEach(function (p) {
                    logger.info("Processing ", p);
                    var composed = composer.composeTemplate(path.basename(p), runtime.readFile(p));
                    out += '<div class="' + parentDivClasses + '">' + composed.content + '</div>';
                });
                project.writeDynamicFile('components-page.html', out);
                return {
                    status: 302,
                    headers: {
                        "Content-Type": "text/html",
                        "Location": "/components-generated.html"
                    },
                    content: out
                };
            }
        },
        "exit": function (request, response) {
            logger.info("Handling exit request received by browser!");
            response.writeHead(200, {
                "Content-Type": "text/html"
            });
            response.on("finish", function () {
                logger.info("Finished response, exiting protostar.");
                process.exit(0);
            });
            response.write("<div>Protostar is exiting by your command, <strong>bye bye</strong>!</div>");
            response.end();
            return false;
        },
        "validate": function (request, response) {

            if (runningValidation) {
                logger.info("Still running screenshotgen");
                response.writeHead(302, {
                    "Location": "http://" + request.headers.host
                });
                response.end();
                return false;
            }
            runningValidation = true;

            var allTemplatePaths = project.listAllTemplatePaths();

            logger.info("Validating " + allTemplatePaths.length  + " pages...");
            var urlErrors = {};
            function removeWrite(templatePaths) {
                if (templatePaths.length < 1) {
                    logger.info("All are empty");
                    return;
                }
                var templatePath = templatePaths[0];
                templatePaths.splice(0, 1);

                var templateUrlPath = runtime.createUrlPathForFile(templatePath);
                var options = {
                    host: (process.env.VCAP_APP_HOST || 'localhost'),
                    port: (process.env.VCAP_APP_PORT || 8888),
                    path: templateUrlPath
                };

                var createUrlErrorsMarkup = function(urlErrors){
                    var out = '<!doctype html><html><body><h1>W3C Markup validation errors</h1>';

                    Object.keys(urlErrors).forEach(function(url){
                        out += '<div>';
                        out+='<h3><a href="'+url+'">'+url+'</a></h3>'
                        var errors = urlErrors[url];
                        if(errors && utils.getObjectType(errors) === 'Array' && errors.length > 0){
                            out+='<dl>';
                            errors.forEach(function(e){
                                out+='<dd>'+ e.error+'</dd><dt><pre><code>'+ utils.encodeHtmlEntities(e.context)+'</code></pre></dt>';
                            });
                            out+='</dl>';
                        }else{
                            out += '<p>Valid!</p>';
                        }
                        out+= '</div>';

                    });
                    return out + '</body></html>';
                };

                var callback = function(valResp) {
                    var str = '';
                    valResp.on('data', function (chunk) {
                        str += chunk;
                    });
                    valResp.on('end', function () {
                        if(runtime.isDebug()){
                            logger.info(str);
                        }
                        w3c.validate(str, function (err) {
                            logger.info("FINISHED VALIDATING " + templateUrlPath, arguments);
                            if (err) {
                                logger.info("Errors for " + templateUrlPath +": ", err);
                                urlErrors[templateUrlPath] = err;
                            } else {
                                logger.info(templateUrlPath + ' is valid!');
                                urlErrors[templateUrlPath] = "ok";
                            }
                            if (allTemplatePaths.length < 1) {
                                runningValidation = false;
                                response.writeHead(200, {
                                    "Content-Type":"text/html"
                                });
                                logger.info("FOUND errors: ", urlErrors);
                                response.write(createUrlErrorsMarkup(urlErrors));
                                response.end();
                            } else {
                                logger.info("Waiting 1500msec before next ...");
                                setTimeout(function(){
                                    logger.info("Invoking");
                                    removeWrite(allTemplatePaths);
                                }, 2000);

                            }
                        });
                    });
                };
                http.request(options, callback).end();
            }
            removeWrite(allTemplatePaths);
            return false;
        },
        "create": function (request, response, project) {
            var url_parts = url.parse(request.url, true);
            var urlPathname = url_parts.pathname;
            var err = 0;
            var template, templatePath;
            if(!runtime.isExistingProjectFilePath(urlPathname.substring(1))){
                logger.info("pathname doesn't exist : " + urlPathname);
                templatePath = url_parts.query.templatePath;
                logger.info("template path = " + templatePath);
                if (runtime.isProjectFileUrlPathname(templatePath)) {
                    template = runtime.readProjectFile(templatePath);
                    var targetPath = runtime.constructProjectPath(urlPathname.substring(1));
                    project.writeFile(targetPath, template);
                    logger.info("Copied " + templatePath + " to " + targetPath);
                } else {
                    err = "Non existing path " + templatePath;
                }
            }else{
                err = "Refusing to create file at exising path: " + urlPathname;
            }
            var out;
            if (err) {
                out = {
                    status: 406,
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    content: err
                };
            } else {
                out = {
                    status: 302,
                    headers: {
                        "Location": "http://" + request.headers.host + urlPathname
                    }
                };
            }
            return out;
        },
        "screenshot-all": function (request, response, project) {
            if (runningScreenshotsGen) {
                logger.info("Still running screenshotgen");
                response.writeHead(302, {
                    "Location": "http://" + request.headers.host
                });
                response.end();
                return false;
            }
            runningScreenshotsGen = true;
            var sizes = {
                smartphone: {
                    width: 320,
                    height: 480
                },
                tablet: {
                    width: 1024,
                    height: 768
                },
                desktop: {
                    width: 1920,
                    height: 1200
                },
                hires: {
                    width: 2880,
                    height: 1800
                }
            };

            function listSizeNames() {
                var sizeNames = [];
                for (var sn in sizes) {
                    if (sizes.hasOwnProperty(sn)) {
                        sizeNames.push(sn);
                    }
                }
                return sizeNames;
            }

            var allSizeNames = listSizeNames();
            var allTemplatePaths = project.listAllTemplatePaths();
            logger.info("AllTemplatePaths: ", allTemplatePaths);
            var cmds = [];
            allSizeNames.forEach(function (sn) {
                allTemplatePaths.forEach(function (tp) {
                    cmds.push({
                        sizeName: sn,
                        path: tp
                    });
                })
            });

            function removeWrite(cmds, dirName) {
                if (cmds.length < 1) {
                    logger.info("All are empty");
                    return;
                }
                var cmd = cmds[0];
                cmds.splice(0, 1);
                var tp = cmd.path;
                var sizeName = cmd.sizeName;
                var tpName = runtime.createUrlPathForFile(tp);
                logger.info("Creating screenshot for " + tpName + " in " + dirName + " for size " + sizeName);

                var screenieName = tpName.substring(1, tpName.lastIndexOf('.')).replace(new RegExp("\\/", 'g'), "__");
                var imageFilename = screenieName + ".png";
                var screeniePath = project.resolveProjectFile("screenshots/" + dirName + "/" + sizeName + "/" + imageFilename);
                utils.ensureParentDirExists(screeniePath);

                screenies.createScreenshotAdvanced("http://localhost:" + (process.env.VCAP_APP_PORT || 8888) + tpName, screeniePath, sizes[sizeName].width, sizes[sizeName].height, function (imagePath) {
                    logger.info("Saved to " + imagePath);
                    if (cmds.length < 1) {
                        runningScreenshotsGen = false;
                        response.writeHead(302, {
                            "Location": "http://" + request.headers.host
                        });
                        response.end();
                    } else {
                        removeWrite(cmds, dirName);
                    }
                });
            }
            var ts = "" + new Date().getTime();
            var screenshotsDirName = "all_" + ts;
            removeWrite(cmds, screenshotsDirName);
            return false;
        }
    };

    this.getCommandNames = function(){
        var names = [];
        for(var nm in commandFactory){
            if(commandFactory.hasOwnProperty(nm) && typeof commandFactory[nm] === 'function'){
                names.push(nm);
            }
        }
        names.sort();
        return names;
    };

    var parseArgs = function (args) {
        runtime = args.runtime;
        composer = args.composer;
        project = args.project;
    };
    parseArgs(args);
    this.handleCommandRequest = function (command, request, response) {
        logger.info("Running command " + command);
        var responseObj = (commandFactory[command])(request, response, project);
        if(runtime.isDebug()){
            logger.info("Ran command " + command + ":", responseObj);
        }else{
            logger.info("Ran command " + command);
        }
        return responseObj;
    }
}

module.exports = {
    createProjectCommandHandler: function (args) {
        return new ProjectCommands(args);
    },
    getCommandNames: function(){
        var names = [];
        for(var nm in commandFactory){
            if(commandFactory.hasOwnProperty(nm) && typeof commandFactory[nm] === 'function'){
                names.push(nm);
            }
        }
        names.sort();
        return names;
    }
};

