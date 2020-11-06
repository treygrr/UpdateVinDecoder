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

        dataset[modelName] = {
            "Articles Count: ": articles.length,
            "Attachments Count": attachements
        };
    }
 
    WriteFile(dataset, 'exportedData.txt');
    console.log('Done!');
    exit();
}


run();