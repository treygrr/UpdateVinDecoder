const dotenv = require('dotenv');
const parseCSV = require('csv-parse');
const fs = require('fs');
dotenv.config({silent: true});
const importer = require('./decoder/Importer'); 
const { exit } = require('process');
  
let fileImport = fs.readFileSync('./csv/1.csv', {encoding: 'utf-8'});

// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'dieselvin_import_production'
// });

// connection.connect(function(err) {
//   if (err) {
//     return console.error('error: ' + err.message);
//   }

//   console.log('Connected to the MySQL server.');
// });

parseCSV(fileImport.toString('utf-8'), {
    columns: ['ID', 'Manufacturer', 'JSON'],
    skip_empty_lines: true,
    from: 2,
}, async (error, records) => {
    if (error) {
        console.log(['Error while parsing CSV: ' + error]);
        return;
    }
    let errors = [];
    let lineNumber = 0;
    for (let record of records) {
        lineNumber++;

        try {
            await importer.put(JSON.parse(record.JSON), true);

        } catch ({message}) {
            errors.push(`ID ${record.ID} at line ${lineNumber}: ${message}`); 
        } 
    }
    exit();
});