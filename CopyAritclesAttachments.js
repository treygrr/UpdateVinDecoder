const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({silent: true});
const { exit } = require('process');
const parseCSV = require('csv-parse');
const { Client } = require('pg');
const pg = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres2',
    password: 'test'
});
  
pg.connect();


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
    let check = records.length;
    for (lineNumber; lineNumber < check; lineNumber++) {
        console.log('current Line: ', lineNumber)
        await GetArticleIDFrom(records[lineNumber].FromModel, records[lineNumber].FromYearFrom, records[lineNumber].FromYearTo === 'NEWER'? 0: records[lineNumber].FromYearTo)
        .then(function (res) {
            console.log(res.rows);  
        })
        .catch(function (res) {
            console.log(res);  
        });

        await GetArticleIDTo(records[lineNumber].ToModel, records[lineNumber].ToYearFrom, records[lineNumber].ToYearTo === 'NEWER'? 0: records[lineNumber].ToYearTo)
        .then(function (res) {
            console.log(res.rows);  
        })
        .catch(function (res) {
            console.log(res); 
        });
    }    
});  


const GetArticleIDFrom = async (FromModel, FromYearFrom, FromYearTo) => {
    let result =  await pg.query(`SELECT id FROM models_pg where name = '${FromModel}' and year_from = ${FromYearFrom} and year_to = ${FromYearTo} and status <> 6`)
    if (result.rows.length === 2) {
        console.log(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`);
        result.rows = result.rows.splice(0, 1);
        console.log('cleaned', result.rows);
    }

    return result;
    
}


const GetArticleIDTo = async (ToModel, ToYearFrom, ToYearTo) => {
    let result =  await pg.query(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`)
    if (result.rows.length === 2) {
        console.log(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`);
        result.rows = result.rows.splice(1, 1);
        console.log('cleaned', result.rows);
    } 
    if (result.rows.length === 0) {  
        console.log(`SELECT id FROM models_pg where name = '${ToModel}' and year_from = ${ToYearFrom} and year_to = ${ToYearTo} and status <> 6`);
    }
    return result;
    
}
