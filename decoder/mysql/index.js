import mysql from 'mysql2/promise';

// The mysql connection parameters are stored in `config/index.js`
import config from './config.js';

/**
 * MySQL Database Connection
 */
class DbConnection {
    /**
     * Constructor
     *
     * @param {String} host
     * @param {String} database
     * @param {String} username
     * @param {String} password
     */
    constructor (host, database, username, password) {
        this.connect();
        this.host = 'localhost';
        this.database = 'dieselvin_import_production';
        this.username = 'root';
        this.password = '';
        console.log(this.host, this.database, this.username, `'${this.password}'`)
    }

    /**
     * Connects to the database
     */ 
    async connect() {
        if (!this.pool) {
            this.pool = mysql.createConnection({
                database: 'dieselvin_staging',
                host: 'localhost',
                // For some ungodly reason this.username is returing an empty string
                user: 'root',
                password: '',
            });
        }

        // this.pool.connect(function(err) {
        //     if (err) {
        //       return console.error('errorq: ' + err.message);
        //     }
          
        //     console.log('Connected to the MySQL server.2');
        //   });

        return this.pool;
    }

    /**
     * Executes an SQL statement.
     *
     * @param {String} sql
     * @param {Array|null} binds
     */
    async execute(sql, binds = undefined) {
        return await (await this.connect()).query(sql, binds);
    }

    /**
     * Executes an SQL statement and retrieves the result set.
     *
     * @param {String} sql
     * @param {Array} binds
     */
    async query(sql, binds = undefined) {
        return (await this.execute(sql, binds))[0];
    }

    /**
     * Fetches all records.
     *
     * @param {String} sql
     * @param {Array} binds
     */
    async fetchAll(sql, binds = undefined) {
        return await this.query(sql, binds);
    }

    /**
     * Fetches the first record of the result.
     *
     * @param {String} sql
     * @param {Array} binds
     */
    async fetchOne(sql, binds = undefined) {
        const rows = await this.query(sql, binds);

        if (rows.length) {
            return rows[0];
        } else {
            throw new QueryResultEmptyError();
        }
    }

    /**
     * Fetches the value of the first column of the first row.
     * Useful to fetch aggregated values or any SQL query that returns just one value.
     *
     * @param {String} sql
     * @param {Array} binds
     */
    async fetchScalarValue(sql, binds = null) {
        const [rows, fields] = await this.execute(sql, binds);

        if (rows.length) {
            return rows[0][fields[0].name];
        } else {
            throw new QueryResultEmptyError();
        }
    }

    /**
     * Disconnects from the database.
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = undefined;
        }
    }

    async transaction(body) {
        const connection = await (await this.connect()).getConnection();

        try {
            await connection.beginTransaction();
            await body(connection);
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            await connection.release();
        }
    }

    escape() {
        return mysql.escape(...arguments);
    }

    format() {
        return mysql.format(...arguments);
    }

    raw() {
        return mysql.raw(...arguments);
    }

    escapeId() {
        return mysql.escapeId(...arguments);
    }
}

// Thrown when a query has no matching result.
export class QueryResultEmptyError extends Error {
    constructor(message = '') {
        super(message || 'No matching records');
    }
}

export default new DbConnection(config.host, config.database, config.username, config.password);
