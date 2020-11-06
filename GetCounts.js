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

const GetAttachments = async (article_id) => {
    const query = `select * from articles_attachments where article_id = ${article_id}`;
    const result = await pg.query(query); 
    return result;
}

/*
    get models
        foreach models
            get articles
                foreach articles
                    get attachements



*/


pg.connect();


fs.writeFileSync(`ExportedArticleData.text`, JSON.stringify(currentFromFail));