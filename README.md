#MIGRATING FROM GIGYA COMMENTS TO SPORTSTALK 24/7
Gigya Comments is reaching end of life.  [Sportstalk can help!](http://www.sportstalk247.com/gigya.html)
##Migrating from Gigya to SportsTalk or other providers.

### Limitations for Gigya Data Migration
GIGYA does not give you the ability to export a list of who liked each comment. Therefore, the LIKES count for comments cannot be migrated to SportsTalk 24/7.
GIGYA does not delete comments when the user account is deleted. However, all comments in SportsTalk 24/7 must have an owner account. Therefore, comments from users that are deleted will not be migrated, and replies to those comments will also not be migrated. In practice we find this is rare and 99%+ of comments are typically migrated.

SportsTalk 24/7 allows you to set a maximum comment length limit. If a GIGYA comment is longer than your allowed limit it will not be migrated.
As is this migration script will not migrate comments that are in unpublished state or removed by a moderator.  However, it is possible to customize the script to force SportsTalk 24/7 API to accept the comment and put it in the moderator rejected state.

The users do not need to exist in SportsTalk 24/7 prior to the migration.  **User accounts will be created within your app** for the commenters as comments and streams are created.


###Step 1: Export Comment Streams and Comments to a JSON file.
Gigya groups comments in what it calls "streams".  All comments about the same article, video, or whatever your commenting context is, are grouped together into streams. The first thing you need to do is export a list of all your comment streams.  Once you have done that you can export all of your comments.  The process of exporting commenThank yout streams and the process of exporting comments are nearly identical.  You can do this using Gigya Data Flows. 
* Create a new data flow to export streams
* Create a new data flow to export comments
* Customize your data flows to export your file to preferred destination for example an FTP or SFTP site
* Use the scheduler to execute the data flow to export all of the streams
* Use the scheduler to execute the data flow to export all of the comments

We estimate that it can export approximately 25,000 comments per hour, so when you plan your migration, start by looking at how many comments you have using the Gigya dashboard and make sure to give yourself enough time.  The streams export is typically faster as there are far fewer streams than comments.  
 
###Step 2: Run the Migration Script provided to import the comments and streams
SportsTalk uses the terminology "Conversation" instead of "Stream". The concept is the same, you are grouping comments into a context.  This script will create a conversation for each stream with your preferred settings.  
* Create your application in SportsTalk 24/7
* Configure the config file to specify your application id and api token
* Configure the config file to point to the stream and comments files you want to load

It's OK to run the import more than one time. You can do an initial export in advance of your move, and then incrementally import additional exported JSON files when you deploy.

## Exporting to JSON - Step By Step
### Exporting Gigya Streams
#### 1. Create dataflow
* Log into the Gigya Console.
* Click on the key for the site you want to export Comments from.
* On the left hand menu, under IdentitySync, select Dataflows.

![Identity Sync Dataflow](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/IdentitySync-DataFlows.jpg)
	
* Click to create a new data flow.

![Create Data Flow](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/2%20-%20Create%20Data%20Flow.jpg)


* In the pop-up, select empty data flow.

![Create Empty Data Flow ](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/3%20-%20Create%20Empty%20Data%20Flow.jpg)


* Select SOURCE TAB, paste the source below in, and then save it. 

* Use the sample script to export to FTP. 

This is a sample script to export your streams to an SFTP server. Contact SAP support for assistance exporting to other destinations.Replace the values within {{ }} with your own
```{
    "apiKey": "{{ PUT YOUR API KEY HERE }}",
    "siteId": {{ PUT YOUR SITE ID HERE },
    "name": "COMMENTS EXPORT STREAMS to SFTP",
    "description": "Export COMMENT STREAMS from Gigya to SFTP",
    "lastRuntime": "2020-04-29T23:58:52.034Z",
    "steps": [{
            "id": "Read comments",
            "type": "datasource.read.gigya.comment",
            "params": {
                "from": "streams",
                "where": "categoryID=\"comments\"",
                "batchSize": 300,
                "keepFieldNamesWithDotAsIs": false
            },
            "next": [
                "Create JSON file"
            ]
        },
        {
            "id": "Create JSON file",
            "type": "file.format.json",
            "params": {
                "fileName": "commentstreams_prod_export_${apiKey}_${now}.json",
                "maxFileSize": 5000,
                "createEmptyFile": false
            },
            "next": [
                "Compress file"
            ]
        },
        {
            "id": "Compress file",
            "type": "file.compress.gzip",
            "params": {},
            "next": [
                "Upload file to SFTP"
            ]
        },
        {
            "id": "Upload file to SFTP",
            "type": "datasource.write.sftp",
            "params": {
                "host": "{{ PUT YOUR SFTP HOST HERE host.domain.com }}",
                "username": "{{ SFTP USER NAME HERE }}",
                "password": "{{ SFTP PASSWORD HERE }}",
                "remotePath": "{{ FOLDER WHERE FILE SHOULD GO LIKE / }}",
                "port": 22,
                "timeout": 60,
                "temporaryUploadExtension": false
            }
        }
    ],
    "updatedByName": "{{ YOUR NAME }}”,
    "updatedByEmail": "{{ YOUR EMAIL }}"
}
```
#### 2. Create a dataflow schedule
* Save and exit back to the Dataflows screen.  
* Click the three “...” button on the right of your data flow in the Actions column, and select Scheduler.  
* Then click the Create Schedule Button. 
    * Enter any value for schedule name.  
    * Set frequency to Run once Set start run time to current date and time (the default)
    * Check the “pull all records (ignore last run time) box
    * Leave log level set to info
    * Leave number of records field blank
    * Put your email address in both the emails on success and emails on failure boxes. The export can take a long time to run, for example, 1 hour for every 30,000 streams. Also, the job could fail in which case it will restart automatically.
* Click the Create Button
* Gigya will run your scheduled job immediately


![Create Export Schedule](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/5%20-%20Create%20Export%20Schedule.jpg)




### Export Comments
#### 1. Create dataflow
* Log into the Gigya Console
* Click on the key for the site you want to export Comments from.
* On the left hand menu, under IdentitySync, select Dataflows.

![Identity Sync Dataflow](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/IdentitySync-DataFlows.jpg)
	
* Click to create a new data flow.

![Create Data Flow](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/2%20-%20Create%20Data%20Flow.jpg)


* In the pop-up, select empty data flow.

![Create Empty Data Flow ](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/3%20-%20Create%20Empty%20Data%20Flow.jpg)


* Select SOURCE TAB, paste the source below in, and then save it. 

This is a sample script to export your streams to an SFTP server. Contact SAP support for assistance exporting to other destinations.
Replace the values within {{ }} with your own
```{
    "apiKey": "{{ PUT YOUR GIGYA API KEY HERE }}",
    "siteId": {{ PUT YOUR GIGYA SITE ID HERE },
    "name": "COMMENTS EXPORT to SFTP",
    "description": "Export COMMENTS from Gigya to SFTP",
    "lastRuntime": "2020-04-24T14:52:30.097Z",
    "steps": [{
            "id": "Read comments",
            "type": "datasource.read.gigya.comment",
            "params": {
                "from": "comments",
                "where": "categoryID=\"comments\"",
                "batchSize": 100,
                "keepFieldNamesWithDotAsIs": false
            },
            "next": [
                "Create JSON file"
            ]
        },
        {
            "id": "Create JSON file",
            "type": "file.format.json",
            "params": {
                "fileName": "comments_prod_export_${apiKey}_${now}.json",
                "maxFileSize": 5000,
                "createEmptyFile": false
            },
            "next": [
                "Compress file"
            ]
        },
        {
            "id": "Compress file",
            "type": "file.compress.gzip",
            "params": {},
            "next": [
                "Upload file to SFTP"
            ]
        },
       {
            "id": "Upload file to SFTP",
            "type": "datasource.write.sftp",
            "params": {
                "host": "{{ PUT YOUR SFTP HOST HERE host.domain.com }}",
                "username": "{{ SFTP USER NAME HERE }}",
                "password": "{{ SFTP PASSWORD HERE }}",
                "remotePath": "{{ FOLDER WHERE FILE SHOULD GO LIKE / }}",
                "port": 22,
                "timeout": 60,
                "temporaryUploadExtension": false
            }
        }
    ],
    "updatedByName": "{{ YOUR NAME }}”,
    "updatedByEmail": "{{ YOUR EMAIL }}"
}
```

![Click Source and Customize Source](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/4%20-%20Click%20Source%20and%20Customize%20Source.jpg)

#### 2. Create schedule
* Save and exit back to the Dataflows screen.  
* Click the three “...” button on the right of your data flow in the Actions column, and select Scheduler.  
    * Then click the Create Schedule Button. 
    * Enter any value for schedule name
    * Set frequency to Run once
    * Set start run time to current date and time (the default)
    * Check the “pull all records (ignore last run time) box
    * Leave log level set to info
    * Leave number of records field blank
    * Put your email address in both the emails on success and emails on failure boxes. The export can take a long time to run, for example, 1 hour for every 30,000 comments. Also, the job could fail in which case it will restart automatically.
* Click the Create Button. Gigya will run the job immediately.

![Create Export Schedule](https://github.com/sportstalk247/gigya-comments-migration/blob/master/img/5%20-%20Create%20Export%20Schedule.jpg)

## Running the migration script
Before using the provided script you **MUST have followed the above instructions and exported your Gigya data to JSON.**

