const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({silent: true});
const { exit } = require('process');
const parseCSV = require('csv-parse');
const { Client } = require('pg');
const ElapsedTime = require('elapsed-time');
const pg = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'testdb',
    password: 'password'
});
  
pg.connect();

let startTimer = ElapsedTime.new().start();

let fileImport = fs.readFileSync('./csv/OEM.csv', {encoding: 'utf-8'});

parseCSV(fileImport.toString('utf-8'), {
    columns: ['FromOEM', 'FromYearFrom', 'FromYearTo', 'FromModel', 'ToOEM', 'ToYearFrom', 'ToYearTo', 'ToModel'],
    skip_empty_lines: true,
    from: 2,
}, async (error, records) => {
    if (error) {
        console.log(['Error while parsing CSV: ' + error]);
        return;
    }
    let lineNumber = 0;
    let totalUpdatedRecords = 0;
    let check = records.length;
    let skippedArticleCount = 0;
    for (lineNumber; lineNumber < check; lineNumber++) {
        // console.log('current Line: ', lineNumber, 'Data: ', 
        // records[lineNumber].FromModel, records[lineNumber].FromYearFrom, records[lineNumber].FromYearTo === 'NEWER'? 0: records[lineNumber].FromYearTo,
        // records[lineNumber].ToModel, records[lineNumber].ToYearFrom, records[lineNumber].ToYearTo === 'NEWER'? 0: records[lineNumber].ToYearTo
        // )
        let FromData = await GetArticleIDFrom(records[lineNumber].FromModel, records[lineNumber].FromYearFrom, records[lineNumber].FromYearTo === 'NEWER'? 0: records[lineNumber].FromYearTo)
        .then(function (res) {
            // console.log(res.rows);  
            return res.rows;
        })
        .catch(function (res) {
            console.log(res);  
        });

        let ToData = await GetArticleIDTo(records[lineNumber].ToModel, records[lineNumber].ToYearFrom, records[lineNumber].ToYearTo === 'NEWER'? 0: records[lineNumber].ToYearTo)
        .then(function (res) {
            // console.log(res.rows);  
            return res.rows
        })
        .catch(function (res) {
            console.log(res); 
        });

        let FromDataArticles = await GetAssociatedArticlesByID(FromData[0].id).then(res=>res.rows).catch(err=>console.log(err));
        // console.log(FromDataArticles);
        let ToDataArticles = await GetAssociatedArticlesByID(ToData[0].id).then(res=>res.rows).catch(err=>console.log(err));
        // console.log(ToDataArticles);
        if ( FromDataArticles.length != ToDataArticles.length){
            console.log('These bitches mis match.', ' From: ',FromDataArticles.length, ' To: ', ToDataArticles.length);
            return;
        }

    
        let counter = 1;

        let articleCount = FromDataArticles.length;
        for (counter; counter < articleCount; counter++) {
            totalUpdatedRecords++;

            let curFrom = FromDataArticles[counter];
            let curTo = ToDataArticles[counter];
            
            // This was supposed to filter but all the articles don't have matching codes so...
        
            // if (curTo.fault1 != curFrom.fault1) return;
            // if (curTo.fault2 != curFrom.fault2) return;
            // if (curTo.pid    != curFrom.pid) return;
            // if (curTo.sid    != curFrom.sid) return;
            // if (curTo.ppid   != curFrom.ppid) return;
            // if (curTo.psid   != curFrom.psid) return;
            // if (curTo.spn    != curFrom.spn) return;
            // if (curTo.fmi    != curFrom.fmi) return;
          
            let FromAttachmentData = await GetArticleAttachmentData(curFrom.id).then(res => res.rows[0]);
            if (FromAttachmentData === undefined) {
                skippedArticleCount++;
                continue;
            }
            await PutArticleData(curTo.id, FromAttachmentData);
            UpdateConsoleProgress(lineNumber, check, counter, articleCount, totalUpdatedRecords, curFrom.id, skippedArticleCount);
        }
    } 
    exit();
});  


const GetArticleIDFrom = async (FromModel, FromYearFrom, FromYearTo) => {
    let result =  await pg.query(`SELECT id FROM models_pg where name = '${FromModel}' and year_from = ${FromYearFrom} and year_to = ${FromYearTo} and status <> 6`)
    if (result.rows.length === 2) {
        //console.log(`SELECT id FROM models_pg where name = '${FromModel}' and year_from = ${FromYearFrom} and year_to = ${FromYearTo} and status <> 6`);
        result.rows = result.rows.splice(0, 1);
        //console.log('cleaned', result.rows);
    }

    return result;
    
}


const GetArticleIDTo = async (ToModel, ToYearFrom, ToYearTo) => {
    let result =  await pg.query(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`)
    if (result.rows.length === 2) {
        //console.log(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`);
        result.rows = result.rows.splice(1, 1);
        //console.log('cleaned', result.rows);
    } 
    if (result.rows.length === 0) {  
        console.log(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`);
    }
    return result;
    
}

const GetAssociatedArticlesByID = async (ModelId) => {
    const result = await pg.query(`SELECT * from articles_pg where model = ${ModelId} order by id`);
    return result;
}

const GetArticleAttachmentData = async (ArticleID) => {
    //  This is an example return result of this query. 
    //
    // {
    //     id: 5472,
    //     article_id: 681801911,
    //     directory: 'C:\\inetpub\\wwwroot\\ACT_20200827_01\\Article_Attachments\\\\681801911_attachments\\784.pdf',
    //     status: 1,
    //     creation_date: 2020-10-08T11:13:03.611Z,
    //     edit_date: null,
    //     file_name: '784.pdf'
    //   }
    const result = await pg.query(`SELECT * from article_attachments_pg where article_id = ${ArticleID}`);
    return result;
}

const PutArticleData = async (ArticleID, payload) => {
    const todaysDate = `2020-10-22 6:00:00`;
    const query = `INSERT INTO article_attachments_pg (id, article_id, directory, status, creation_date, edit_date, file_name) VALUES ((select MAX(id)+1 from article_attachments_pg id), ${ArticleID}, '${payload.directory}', ${(payload.status)}, '${todaysDate}', '${todaysDate}', '${payload.file_name}')`;
    const result = await pg.query(query); 
    return result;
}

const UpdateConsoleProgress =  (LineSet, check, Progress, TotalProgress, totalUpdatedRecords, currentModelFrom, skippedArticleCount) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`Working on Model ${LineSet} of ${check}. Updating Article ${Progress} of ${TotalProgress}. Total Article Attachments Generated: ${totalUpdatedRecords} Elapsed Time: ${startTimer.getValue()} Current Articled From:  ${currentModelFrom} Skipped Articles: ${skippedArticleCount}`);
}