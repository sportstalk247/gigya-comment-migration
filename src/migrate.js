'use strict';
const fs = require('fs');
const sdk = require('sportstalk-sdk')
const SHA256 = require("crypto-js/sha256");
const config = require('./config.js');

// TODO:
// Handle this via command line arguments and .env files.
const environment = "sandbox";

// TODO: 
// Change replacement patter so = becomes - and / becomes _
// Override timestamp on created streams and comments

// Configuration settings:
// API TOKEN to use
// To SDK or to not SDK?
//  - what fields do we need to override?
const env = config.getEnv(environment);
const client = sdk.CommentClient.init({ apiToken: env.token, appId: env.appid });


// Read in the STREAM data
// Create all the channels
// ? What fields need to be overriden? When added? Updated?

// Read in the COMMENT data
// Insert the COMMENTS

// QUESTIONS
// ? How will we get LIKE info?
// ? What do we do about comments that were not approved by a moderator? Ignore them? Preserve them?
let streams = {};
let comments = {};
let stats = {
    numStreams: 0,
    processedStreams: 0,
    streamInserted: 0,
    streamUpdated: 0,
    streamNoChange: 0,
    streamErrors: 0,
    numComments: 0,
    processedComments: 0,
    commentErrors: 0,
    commentSkippedEmpty: 0,
    commentSkippedRejected: 0,
    commentSkippedError: 0,
    commentSkippedNoParent: 0,
    commentSkippedNoUserId: 0,
    commentSkippedNotPublished: 0,
    commentCustomIdInUse: 0,
    commentSkippedLength: 0,
    errGatewayTimeout: 0
};

let gl_commentServerError = [];

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function toConversationId(streamID) {
    // This is the agreed upon method for encoding the conversationid.  In order to change this
    // rule you must coordinate with AEM team and back end team maintaining labmda
    return SHA256(streamID).toString();

}

function loadStreams(streamFile) {
    let rawdata = fs.readFileSync(streamFile);
    streams = JSON.parse(rawdata);
    stats.numStreams = streams.length.toString();
    console.log(stats.numStreams.toString() + " streams read from import file");
}

function loadCommentsFromOutputFile(commentFile) {
    let rawdata = fs.readFileSync(commentFile);
    comments = JSON.parse(rawdata);
    stats.numComments = comments.length.toString();
    console.log(stats.numComments.toString() + " comments read from import file");
}

function loadData(streamFile, commentFile) {
    loadStreams(streamFile);
    loadCommentsFromOutputFile(commentFile);
}

let importGigyaStreams = async function() {

    for (let loop = 0; loop < streams.length; loop++) {
        console.log('IMPORT STREAM: ' + streams[loop].streamID);

        let conversationid = toConversationId(streams[loop].streamID);
        console.log('--> conversationid = ' + conversationid);

        let customid = streams[loop].streamID;
        let added = new Date(streams[loop].timestamp).toISOString();
        let title = "";
        let isopen = true;

        // Titles can be blank
        if (typeof streams[loop].streamTitle !== 'undefined') {
            title = streams[loop].streamTitle;
            console.log('--> title = ' + title);
        }

        try {
            const convo = await client.createConversation({
                conversationid: conversationid,
                customid: customid,
                property: "chelseafc.com",
                moderation: "post",
                maxreports: 3,
                title: title,
                conversationisopen: true,
                maxcommentlen: 1000,
                added: added
            });
            console.log('--> OK Successfully imported stream');
            stats.processedStreams = stats.processedStreams + 1;
            await sleep(50);
        } catch (err) {
            console.error('--> ERROR importing stream');
            if (err.response.data) {
                console.error(err.response.data);
            } else {
                console.error(error.response);
            }
            stats.streamErrors = stats.streamErrors + 1;
        }
    }
}

// Return true if a comment is inserted into the database
let importOneComment = async function(cur, inserted, skipped) {
    if (!(cur.ID in inserted) && !(cur.ID in skipped)) {
        let commentdata = {};

        // We found a comment that hasn't been inserted or skipped yet
        // Find its conversation
        await client.getConversation(toConversationId(cur.streamId)).then(function(conversation) {
            console.log("--> conversation.customid = " + conversation.customid);

            // I just got this but I have to set it anyway
            client.setCurrentConversation(conversation);

            // Insert the comment
            commentdata = {
                customid: cur.ID,
                body: cur.commentText,
                custompayload: null,
                userid: cur.sender.UID,
                displayname: cur.sender.name,
                pictureurl: cur.sender.photoURL,
                added: new Date(cur.timestamp).toISOString()
            };

            if (cur.note) {
                console.log("Comment has a note, capturing it in custompayload field");
                commentdata.custompayload = cur.note;
            }

            if (!commentdata.userid) {
                console.log("--> SKIPPED (userid is missing");
                skipped[cur.ID] = true;
                stats.commentSkippedNoUserId = stats.commentSkippedNoUserId + 1;
                return false;
            }

            console.log("CREATE COMMENT customid = " + commentdata.customid);
            if (!commentdata.body || !(commentdata.body.trim())) {

                console.log("--> SKIPPED (body is empty)");
                skipped[cur.ID] = true;
                stats.commentSkippedEmpty = stats.commentSkippedEmpty + 1;
                return false;
            }

            // Check if status is not published
            if (cur.status !== "published") {
                console.log("--> SKIPPED (status is not published) status = " + cur.status);
                skipped[cur.ID] = true;
                stats.commentSkippedNotPublished = stats.commentSkippedNotPublished + 1;
                return false;
            }

            // TODO: Check if message was deleted or removed by moderator
            if (cur.rejectInfo.reason !== 0) {
                console.log("--> Rejection info: " + JSON.stringify(cur.rejectInfo));
                skipped[cur.ID] = true;
                stats.commentSkippedRejected = stats.commentSkippedRejected + 1;
                return false;
            }



            // TODO:
            // * moderatorEdit -> ignore                    
            // * edited -> edited
            // * rejectInfo / state / status -> moderationState
            if (cur.parentId) {
                if (!(cur.parentId in inserted)) {
                    // We can't insert this comment until its parent has been inserted
                    console.log("--> PARENT not inserted yet parent.customid = " + cur.parentId);
                    return false;
                } else {
                    console.log("--> PARENT dependency satisifed. parent.customid = " + cur.parentId);
                }

                commentdata.replyto = cur.parentId;
            }

            let thing = client.publishComment(commentdata).then(function(comment) {
                console.log("--> OK COMMENT CREATED (" + comment.id + ")");

                // If we insert something, set bFound = true                
                stats.processedComments = stats.processedComments + 1;

                // Add item to inserted list in case it has children to signal that the children can be inserted
                inserted[comment.customid] = true;

                return true;
            }).catch(function(err) {
                if (!err.response || !err.response.data) {
                    console.error("Response had an error and data member was undefined.");
                }
                // Add item to the skipped list because it cannot be inserted. This means any children of this will also be skipped.
                else if (err.response.data.message === "The comment cannot be created because the specified customid is already in use.") {
                    console.log("SKIPPED.  This comment is already imported")
                    skipped[cur.ID] = true;
                    stats.commentCustomIdInUse - stats.commentCustomIdInUse++;
                } else if (err.response.data.message === "The comment length exceeds the maximum comment length allowed for this conversation.") {
                    console.log("SKIPPED. Comment length (" + commentdata.body.length.toString() + ") too long");
                    stats.commentSkippedLength - stats.commentSkippedLength++;
                } else {
                    console.error("--> ERROR creating comment...");
                    if (err.response.status === 504) {
                        console.error("--> GATEWAY TIMEOUT (504)");
                        errGatewayTimeout = errGatewayTimeout + 1;
                    } else if (typeof(err.response.data.message) === "undefined") {
                        console.log(err).response;
                    } else {
                        console.error("--> " + err.response.data.message);
                    }

                    if (err.response.data.errors) {
                        console.error("--> " + JSON.stringify(err.response.data.errors));
                    }

                    if (err.response.status === 500) {
                        console.error("--> SERVER ERROR PROCESSING COMMENT id = " + cur.ID);
                        gl_commentServerError.push(cur);
                    }

                    // Problem processing the comment   
                    stats.commentSkippedError = stats.commentSkippedError + n1;
                    skipped[cur.ID] = true;
                }
                return false;
            });

            return true;
        }).catch(function(err) {
            console.error(err);
            console.log("COMMENT " + cur.ID + " conversation missing (" + cur.streamId + ")");
            skipped[cur.ID] = true;

            return false;
        });
    }
}

let importComments = async function() {
    // In order to load the comment, the parent of that comment must exist which means we need some tree hierarchy
    // Dictionary Inserted[commentid] = ?
    // Loop through comments.
    // For each comment....
    //      If it has no parent, add it to list of INSERTED comments immediately and upload it to ST
    //      If it has it has a parent, check if parent has been inserted. If parent has not been inserted, skip.
    //      Repeat until all nodes are inserted or you loop through entire list and find nothing you can insert (these are the orphans)
    let inserted = {};
    let skipped = {};
    let bInserted = false;
    let bFinished = false;

    // Loop through comments over and over until we are only left with orphans that can't be inserted
    while (!bFinished) {
        // Flag that this iteration hasn't inserted anything yet 
        bInserted = false;

        for (let i = 0; i < comments.length; i++) {
            bInserted = await importOneComment(comments[i], inserted, skipped);
            await sleep(50);
        }

        if (!bInserted) {
            bFinished = true;
        }
    }

    // Report
    console.log("=============================[ COMMENTS WITH ERRORS REPORT ]=============================");
    for (let loop = 0; loop < gl_commentServerError.length; loop++) {
        console.log(gl_commentServerError[loop].ID);
    }
}

let checkSportstalkCommentAccess = async function() {
    await client.listConversations({ limit: 2000 }).then(function(cursor) {
        console.log("Listed conversations successfully.");
        for (let loop = 0; loop < cursor.conversations.length; loop++) {
            console.log('(' + cursor.conversations[loop].conversationid + ') ' + cursor.conversations[loop].title);
        }
    }).catch(function(err) {
        console.error(err);
    });
}

let migrateGigyaCommentsToSportstalk = async function() {

    try {
        // Load the data
        loadData(env.streamFileName, env.commentFileName);

        // Check we can access SportsTalk247, that our APPID and TOKEN are valid
        await checkSportstalkCommentAccess();

        let startTime = new Date();
        await importGigyaStreams();

        await importComments();

        let endTime = new Date();
        let timeDiff = (endTime - startTime) / 1000; // Difference without MS
        let seconds = Math.round(timeDiff);

        console.log("TIME: " + seconds.toString() + " + seconds STREAMS... TOTAL: " + stats.numStreams.toString() + " PROCESSED: " + stats.processedStreams.toString() + " ERRORS: " + stats.streamErrors.toString());
        console.log("STATS: ");
        console.log(JSON.stringify(stats));
    } catch (err) {
        console.error(err);
    }
}

migrateGigyaCommentsToSportstalk();

module.exports = {
    migrateGigyaCommentsToSportstalk
}