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

var tc = require("../lib/templateComposer");
var fs = require("fs");
//var fileResolverFactory = require("../lib/fileResolver");
var testUtils = require("../lib/testUtils");
var path = require("path");
var templatesParent =path.join(testUtils.getTestProjectDir(), "component") + "/";

function newTemplateComposer(){
//    var args = {};
//    args.port = 9999; //= args.port || 8888;
//    args.writeResponsesToFiles = true;
//    args.writtenResponsesParent = "/tmp";
//    args.defaultPageTemplatePath = '/parts/page.html';
//    args.dropPointTypes = ["part", "layout", "content", "file"];
//    args.partTypePaths = {
//        part : "parts",
//        layout: "layouts",
//        component: "component"
//    };
//    args.enableDebug = false;

    var h = tc.createTemplateComposer({
        runtime: testUtils.createTestRuntime()
    });
    return h;
}

describe("Template Compser", function () {

    it("should create a template composer", function () {
        console.log("test1");
//        var args = {};
//        args.port = 9999; //= args.port || 8888;
//        args.writeResponsesToFiles = true;
//        args.writtenResponsesParent = "/tmp";
//        args.defaultPageTemplatePath = '/parts/page.html';
//        args.dropPointTypes = ["part", "layout", "content", "file"];
//        args.partTypePaths = {
//            part : "parts",
//            layout: "layouts",
//            component: "component"
//        };
//        args.enableDebug = false;
//        args.fileResolver = fileResolverFactory.createFileResolver({
//            workingDirectory : "/home/spectre/Projects/proto-star",
//            projectDir : "/home/spectre/Projects/proto-star/projects/test",
//            appDir : "/home/spectre/Projects/proto-star"
//        })
        var h = newTemplateComposer();
        expect(typeof h).toBe("object");
        var templatePaths = fs.readdirSync(templatesParent);
        var num = 0;
        templatePaths.forEach(function(p, idx){
            var filePath = templatesParent + p;
            if(fs.statSync(filePath).isFile() && filePath.indexOf(".html") > 0){
                var fileContents = '' + fs.readFileSync(filePath);
                console.log("Composing " + p);
                var composed = h.composeTemplate(filePath, "" + fileContents);
                num +=1;
                console.log("Compiled from " + p + " " + fileContents.length + " bytes => " + composed.content.length + " bytes");
            }
        });
        console.log("Compiled " + num + " templates");
    });
    it("Should find composed page part markers", function(){
        console.log("test2");
        var templatePaths = fs.readdirSync(templatesParent);
        templatePaths.forEach(function(p, idx){
            var filePath = templatesParent + p;
            console.log("Checking " + filePath);
            if(fs.statSync(filePath).isFile() && filePath.indexOf("-compiled.html") > 0){
                console.log(filePath + " exists");
                var fileContents = '' + fs.readFileSync(filePath);
                console.log("read file")
                var markers = tc.decompile(fileContents);
                console.log("found markers");
                if(markers.length  >0){
                    expect(markers.length > 0).toBe(true);
                    markers.forEach(function(m){
                        console.log("inspecting marker:", m);
                        var fn = templatesParent+ m.name + '.html';
                        console.log("Inspecting filename " + fn);
                        expect(fs.statSync(fn).isFile()).toBe(true);
                        var partContents = (fs.readFileSync(fn) + '').trim();
                        var pc = tc.replaceMarkedContentWithDropPoints(m.content).trim();
//                        expect(partContents).toBe(pc);
                    });
                }
                console.log("Found markers:", markers);
                var converted = tc.replaceMarkedContentWithDropPoints(fileContents);
                console.log("CONVERTED BACK TO TEMPLATE : \n" + converted);
                expect(converted.indexOf('<!-- begin_') < 0).toBe(true);
            }else{
                console.log("Not a compiled file : "+ filePath);
            }
        });
        console.log("Finished")
    });
    it("Should replace marked content again with dropPoints", function(){
        console.log("test3");
        var cnt = "This is content <!-- begin_file-component/nav -->INSIDE<!-- end_file-component/nav --> with some more content after the marker. <!-- begin_file-component/other -->INSIDEOTHER<!-- end_file-component/other -->And more here.";
        var decompiled = tc.decompile(cnt);
        var content = decompiled.content;
        expect(content.length < cnt.length).toBe(true);
        var markers = decompiled.markers;
//        markers.sort(function(a,b){
//
//        });
        expect(markers.length).toBe(2);

        expect(content).toBe("This is content <!-- file:component/nav --> with some more content after the marker. <!-- file:component/other -->And more here.");
        var marker = markers[0];
        expect(marker.name).toBe("component/nav");
        expect(marker.content).toBe("INSIDE");
    });

    it("Should replace top level inclusions only", function(){
        console.log("test4");
        var cnt = "This is content <!-- begin_file-component/nav -->INSIDE1<!-- begin_file-component/nav -->INSIDE2<!-- end_file-component/nav -->INSIDE1<!-- end_file-component/nav --> with some more content after the marker.";
        var decompiled = tc.decompile(cnt);

        var content = decompiled.content;
        expect(content.length < cnt.length).toBe(true);
        var markers = decompiled.markers;
        expect(markers.length).toBe(1);
        var marker = markers[0];
//        expect(marker.start).toBe(999);
//        expect(marker.end).toBe(999);
        expect(content).toBe("This is content <!-- file:component/nav --> with some more content after the marker.");

        expect(marker.name).toBe("component/nav");
        expect(marker.type).toBe("file");
        expect(marker.content).toBe("INSIDE1<!-- begin_file-component/nav -->INSIDE2<!-- end_file-component/nav -->INSIDE1");
    });

    it("Should include fragment args", function(){
        console.log("test5");
        var cnt = "This is content <!-- begin_file-component/nav -->INSIDE1<!-- begin_file-component/nav -->INSIDE2<!-- end_file-component/nav -->INSIDE1<!-- end_file-component/nav --> with some more content after the marker.";
        var decompiled = tc.decompile(cnt);
        var content = decompiled.content;
        expect(content.length < cnt.length).toBe(true);
        var markers = decompiled.markers;
        expect(markers.length).toBe(1);

        expect(content).toBe("This is content <!-- file:component/nav --> with some more content after the marker.");
        var marker = markers[0];
        expect(marker.name).toBe("component/nav");
        expect(marker.type).toBe("file");
        expect(marker.content).toBe("INSIDE1<!-- begin_file-component/nav -->INSIDE2<!-- end_file-component/nav -->INSIDE1");
        cnt = "This is content <!-- begin_file-component/nav -->INSIDE1<!-- begin_file-component/nav -->INSIDE2<!-- end_file-component/nav -->INSIDE1<!-- end_file-component/nav --> with some more content after the marker.";
        var dr = tc.decompileRecursive(cnt);
        expect(dr.markers.length).toBe(2)
    });

    it("counts occurrences in text between indexes", function(){
        console.log("test6");
        var cnt = "aaaa"
        var count = tc.countOccurrencesBetweenIndexes(cnt, "a", 1, 3);
        expect(count).toBe(2);
    });
    it("find the nth occurrence", function(){
        console.log("test6");
        var cnt = "babababab"
        var indx = tc.findNthOccurrence(cnt, "a", 1, 0);
        expect(indx).toBe(1);
        var indx = tc.findNthOccurrence(cnt, "a", 2, 0);
        expect(indx).toBe(3);
        var indx = tc.findNthOccurrence(cnt, "a", 2, 2);
        expect(indx).toBe(5);

    });

    it("should support new layout args: surrounded by braces, assigning string as content, by name, multiple per droppoint, nested", function(){
    //    <!-- layout:layouts/fullPage(file:_dynamic/list-referencing-bare;layout:layouts/fullPage(component/myEditableComponent);file:component/myComponent) -->
    //    <!-- layout:layouts/fullPage(nav=file:_dynamic/list-referencing-bare;top=layout:layouts/fullPage(component/myEditableComponent);bottom=file:component/myComponent) -->
        var tp = newTemplateComposer();



    });


//    it("should decompile adp index.html", function(){
//        console.log("test7");
//        console.log("DECOMPILING ADP");
//        var cnt = fs.readFileSync("/home/spectre/Projects/protostar-projects/adp/index-compiled.html");
//        var decompiled = tc.decompileRecursive(cnt);
//        console.log("NOT DECOMPILED ADP:", decompiled.content);
//        decompiled.markers.forEach(function(m){
//            console.log("- marker:  " + m.name);
////            console.log("  content:  " + m.content);
//        })
//    });
//
//    it("should decompile our test project :-)", function(){
//        console.log("test7");
//        console.log("DECOMPILING ADP");
//        var cnt = fs.readFileSync(testUtils.getTestProjectDir() + "/index-compiled.html");
//        var decompiled = tc.decompileRecursive(cnt);
//        console.log("NOT DECOMPILED ADP:", decompiled.content);
//        decompiled.markers.forEach(function(m){
//            console.log("- marker:  " + m.name);
////            console.log("  content:  " + m.content);
//        })
//    });


//    it("Should collect compiled template markers", function(){
//        var tp = newTemplateComposer();
//        var cnt = "This is content <!-- begin_file-component/nav -->INSIDE<!-- end_file-component/nav --> with some more content after the marker.";
//        expect(tp.collectCompiledTemplateMarkers(cnt).length).toBe(1);
//    });

});