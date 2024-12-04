// create_admin.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./db/database.sqlite');

const username = 'admin';
const password = 'adminpass';
const is_admin = 1;

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        process.exit(1);
    }
    db.run('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)', [username, hash, is_admin], function(err) {
        if (err) {
            console.error('Error inserting admin user:', err);
        } else {
            console.log('Admin user created with ID:', this.lastID);
        }
        db.close();
    });
});
