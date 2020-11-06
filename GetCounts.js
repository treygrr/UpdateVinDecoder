const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({silent: true});
const { exit } = require('process');
const { Client } = require('pg');
const ElapsedTime = require('elapsed-time');
const pg = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'testdb',
    password: 'password'
});

const GetModels = async () => {
    const query = `select * from models_pg where status <> 6`;
    const result = await pg.query(query); 
    return result;
}

const GetArticles = async (model_id) => {
    const query = `select * from articles_pg where model = ${model_id} and status <> 6`;
    const result = await pg.query(query); 
    return result;
}

const GetAttachments = async (model_id) => {
    const query = `select count(*) from article_attachments_pg where article_id in (select id from articles_pg where model = ${model_id} and status <> 6);`;
    const result = await pg.query(query); 
    return result;
}

const WriteFile = (fileToWrite, fileName) => {
    fs.writeFileSync(fileName, JSON.stringify(fileToWrite));
}

const SortArticles = (articles) => {
    let status1 = 0;
    let status2 = 0;
    let status3 = 0;
    let status4 = 0;
    let status5 = 0;
    let status6 = 0;
    let status7 = 0;
    let status8 = 0;

    for (const article in articles) {
        switch (articles[article].status) {
            case 1:
                status1++
                break;
            case 2:
                status2++
                break;
            case 3: 
                status3++
                break;
            case 4:
                status4++
                break;
            case 5: 
                status5++
                break;
            case 6:
                status6++
                break;
            case 7:
                status7++
                break;
            case 8:
                status8++
                break;
        }
        
    }
    // console.log({status1, status2, status3, status4, status5, status6, status7, status8})
    return { status1, status2, status3, status4, status5, status6, status7, status8 }
}

/*
    get models
        foreach models
            get articles
                foreach articles
                    get attachements
        saveData



*/
pg.connect();

const run = async () => {
    let dataset = {};
    let models = await GetModels().then(res => res.rows).catch(err => console.log(err));
    for (const model in models) {
        // console.log(models[model].name);
        let articles = await GetArticles(models[model].id).then(res => res.rows).catch(err => console.log(err));
        let articlesattachmentcount = 0;

        let attachements = await GetAttachments(models[model].id).then(res => res.rows[0].count).catch(err => console.log(err));

        let modelName = models[model].name.toString();
        let articlesBreakDown = {}


        

        dataset[modelName] = {
            "Articles Count: ": articles.length,
            "Articles Status Count": SortArticles(articles),
            "Attachments Count": attachements
        };
    }
 
    WriteFile(dataset, 'exportedData.txt');
    console.log('Done!');
    exit();
}


run();