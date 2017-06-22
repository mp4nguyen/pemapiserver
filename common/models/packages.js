
module.exports = function(Packages) {
    //Update or new package with assessments
    Packages.upsertPackage = function(data,successCb) {

        var package = data.package;
        var assessments = data.assessments;
        ///
        if(package){
            //console.log("Update package");
            Packages.beginTransaction({isolationLevel: Packages.Transaction.READ_COMMITTED}, function(errTran, tx) {
                //console.log("Packages.beginTransaction ", errTran);
                //Packages.update({where:{"id":package.id}},{"packageName":that.packageName},{transaction: tx},function(res){
                //Packages.upsert({"id":package.id,"packageName":package.packageName},{transaction: tx},function(err,pack){
                Packages.update({id:package.id},{packageName:data.packageName},{transaction: tx},function(err,rs){
                    //console.log("After upsert package ", err,rs);
                    //$log.debug("Updated package successfully");
                    Packages.app.models.PackagesAssessments.destroyAll({"packId":package.id},{transaction: tx},function(eDelete,r){
                        //console.log("destroy all assessments ",eDelete,r);
                        var packageAssessments = [];
                        for(var i in assessments){
                            //console.log(assessments[i]);
                            var packageAssessmentObj = {};
                            packageAssessmentObj.packId = package.id;
                            packageAssessmentObj.assId = assessments[i];
                            packageAssessments.push(packageAssessmentObj);
                        }
                        //console.log("Will insert assessments ",packageAssessments)
                        Packages.app.models.PackagesAssessments.create(packageAssessments,{transaction: tx},function(eAssess,r){
                            if(eAssess){
                                //console.log("Error inserted assessments", eAssess);
                                tx.rollback(function(err) {
                                    //console.log("Error to rollback the transaction", err);
                                    var returnObj = {};
                                    returnObj.packageHeader = err;
                                    returnObj.deleteAss =  eDelete;
                                    returnObj.packagesAssessments = eAssess;
                                    //console.log(returnObj);
                                    successCb(returnObj,null);
                                });
                            }
                            else{
                                //console.log("inserted assessments successfully", r);
                                tx.commit(function(err) {
                                    //console.log("Error to commit the transaction", err);
                                    var returnObj = {};
                                    returnObj.packageHeader = rs;
                                    returnObj.packagesAssessments = r;
                                    successCb(null,returnObj);
                                });
                            }
                            //$log.debug("after inserted assessments",r);
                        });
                    });
                });
            });
        }else{
            var newPackageObj = {};
            newPackageObj.packageName = data.packageName;
            newPackageObj.companyId = data.companyId;
            newPackageObj.id = 0;
            //console.log("newPackageObj = ",newPackageObj);
/*
            MyModel.beginTransaction('READ COMMITTED', function(err, tx) {
                MyModel.create({x: 1, y: 'a'}, {transaction: tx}, function(err, inst) {
                    MyModel.find({x: 1}, {transaction: tx}, function(err, results) {
                        // ...
                        tx.commit(function(err) {...});
                    });
                });
            });
  */
            Packages.beginTransaction({isolationLevel: Packages.Transaction.READ_COMMITTED}, function(err, tx) {
                //console.log("Packages.beginTransaction = ",err);
                // Now we have a transaction (tx)
                Packages.create(newPackageObj, {transaction: tx},function(e,rs) {
                    if(e){
                        console.log("Error inserted packages", e);
                    }
                    else{
                        //console.log("inserted packages successfully", rs);
                        var packageAssessments = [];
                        for (var i in assessments) {
                            //console.log(that.assessments[i]);
                            var packageAssessmentObj = {};
                            packageAssessmentObj.packId = rs.id;
                            packageAssessmentObj.assId = assessments[i];
                            packageAssessments.push(packageAssessmentObj);
                        }
                        //console.log("Will insert assessments", packageAssessments)
                        Packages.app.models.PackagesAssessments.create(packageAssessments, {transaction: tx}, function (eAssess, r) {

                            if(eAssess){
                                //console.log("Error inserted assessments", eAssess);
                                tx.rollback(function(err) {
                                    //console.log("Error to rollback the transaction", err);
                                    var returnObj = {};
                                    returnObj.packageHeader = e;
                                    returnObj.packagesAssessments = eAssess;
                                    successCb(returnObj,null);
                                });
                            }
                            else{
                                //console.log("inserted assessments successfully", r);
                                tx.commit(function(err) {
                                    //console.log("Error to commit the transaction", err);
                                    var returnObj = {};
                                    returnObj.packageHeader = rs;
                                    returnObj.packagesAssessments = r;
                                    successCb(null,returnObj);
                                });
                            }
                        });
                    }
                });
            });
        }
    };
    Packages.remoteMethod('upsertPackage', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: {arg: 'upsertPackage', type: 'array'},
        http: {path:'/upsertPackage', verb: 'post'}
    });
    // list Assessment Headers
    Packages.listAssessments = function(packageId,cb) {

        Packages.find({"where": {"id": packageId},"include": {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]  ,"scope": {"include": ["assessmentHeaders"]}  }}},function(err, project){
            cb(null,project);
        });

            //.Assessments({id:packageId},cb);  , "scope": {"include": ["students"]}
    };
    Packages.remoteMethod('listAssessments', {
        accepts: [
            {arg: 'id', type: 'number'},
        ],
        returns: {arg: 'packages', type: 'array'},
        http: {path:'/assessments', verb: 'get'}
    });


//     Packages.on('attached', function(obj){
//         var find = Packages.find;
//         Packages.find = function(filter, cb) {
//             if(arguments[0]){
//                 arguments[0].include = {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}};
//             }else{
//                 arguments[0] = {};
//                 arguments[0].include = {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}};
//             }
//
//             //console.log(">>>>><<<<<< Packages.find arg=",arguments[0],"  ",arguments[1]);
//             //find({"where": {"id": 9},"include": {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]  ,"scope": {"include": ["assessmentHeaders"]}  }}},cb);
// //{"where": {"id": 9},"include": {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]  ,"scope": {"include": ["assessmentHeaders"]}  }}}
//             return find.apply(this, arguments);
//         };
//     });

};
