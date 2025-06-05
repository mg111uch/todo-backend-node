
// const dotenv = require('dotenv');
// import cors from 'cors';
const cors = require('cors');
// dotenv.config();
// import express from 'express';
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());

const PORT = 3001;

const corsOptions = {
  origin: ['http://localhost:3000'], // Allow requests from your React app
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
  // allowedHeaders: ['Content-Type', 'Authorization'] // Specify allowed headers
  allowedHeaders: ['*'] 
};
app.use(cors(corsOptions));

const execute = async (db, sql, params = []) => {
  if (params && params.length > 0) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
};
const fetchAll = async (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
};
const fetchitem = async (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};

const accessDB = async (db_operation, payload) => {
  const db = new sqlite3.Database("collection.db", sqlite3.OPEN_READWRITE);
  
  let sheetdata2_Json  = { values: [] }   
  try {
    if (db_operation == 'auth') {
      const enterName = payload.enterName
      const enterPhone = payload.enterPhone
      const password = payload.password
      const newUser = payload.newUser
      if(newUser){
        const sql = `INSERT INTO auth(ownername, phoneno, password) VALUES(?, ?, ?)`
        await execute(db, sql, [enterName, enterPhone, password]);
        sheetdata2_Json.values = ['User Account Added'] 
      }else{
        const sql = "SELECT * FROM auth WHERE ownername = ? AND phoneno = ?"
        const fetchdata = await fetchAll(db, sql, [enterName,enterPhone])
        // console.log(fetchdata)
        if(fetchdata.length == 1){
          if(fetchdata[0]['password'] == password){
            sheetdata2_Json.values = ['Verified'] 
          }  else{
            sheetdata2_Json.values = ['Not Verified'] 
          } 
        } 
      }
    }
    if (db_operation == 'read') {      
      const currentRow = payload.currentrow
      const numRows = 5
      let fetchdata = null   
      var totalRows = null
      
      if(payload.filterby == ''){      
        // let sql = `SELECT * FROM items`
        let sql = `SELECT * FROM items LIMIT ${numRows} OFFSET ${currentRow}`
        fetchdata = await fetchAll(db,sql)
        sql = `SELECT COUNT(*) AS count FROM items`
        totalRows = await fetchitem(db,sql)
        // console.log(totalRows)
      }else{
        const filterby = payload.filterby
        const range = payload.range
        const keys = Object.keys(filterby)
        var condtn = ``
        var values = []
        var first = true
        if(filterby != ''){ 
          for(let i=0;i<keys.length;i++){
            if(filterby[keys[i]] != ''){
              if(first ==true){
                condtn += `${keys[i]} = ?`
                first = false
              }else{
                condtn += ` AND ${keys[i]} = ?` 
              }
              values.push(filterby[keys[i]])
            }
          }  
        }
        if(range != ''){
          if(range.pricefrom != ''){
            if(condtn == ''){
              condtn += `rentalprice > ${range.pricefrom}`
            }else{
              condtn += ` AND rentalprice > ${range.pricefrom}`
            }
          }
          if(range.priceto != ''){
            if(condtn == ''){
              condtn += `rentalprice < ${range.priceto}`
            }else{
              condtn += ` AND rentalprice < ${range.priceto}`
            }
          }  
        } 
        const query = `SELECT * FROM items WHERE ${condtn} LIMIT ${numRows} OFFSET ${currentRow}`
        // console.log(query)
        fetchdata = await fetchAll(db, query, values)
        let sql = `SELECT COUNT(*) AS count FROM items WHERE ${condtn}`
        // console.log(sql)
        totalRows = await fetchitem(db,sql, values)
        // console.log(totalRows)
      } 
      if(fetchdata && fetchdata.length != 0){
        let jsonObjectsToArray = []
        fetchdata.forEach(object => {       
          var valuesArray =  Object.values(object)   
          valuesArray.shift()
          jsonObjectsToArray.push(valuesArray)
        })
        jsonObjectsToArray.push(totalRows.count)
        sheetdata2_Json.values = jsonObjectsToArray
      }
    }
    if (db_operation == 'create') {
      const toCreate = payload.toCreate
      const sql = `INSERT INTO items(timestamp, title, description, propertyaddress, locality, city, ownername, phoneno, rentalprice, likestatus, type) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      await execute(db, sql, toCreate);
      sheetdata2_Json.values = ['Data created.'] 
    }
    if (db_operation == 'update') {
      const updatedArray = payload.toUpdate
      const itemId = updatedArray[0]
      let ValuesArray = updatedArray.slice(1,updatedArray.length)
      ValuesArray.push(itemId)
      const sql = `UPDATE items SET title = ?, description = ?, propertyaddress = ?, locality = ?, city = ?, ownername = ?, phoneno = ?, rentalprice = ?, likestatus = ?, type = ? WHERE timestamp = ?`
      await execute(db, sql, ValuesArray);
      sheetdata2_Json.values = ['Values updated.'] 
    }
    if (db_operation == 'delete') {
      const toDeleteID = payload.toDeleteID
      const sql = `DELETE FROM items WHERE timestamp = ?`  
      const res = await execute(db, sql, [toDeleteID]);
      // console.log(res)
      sheetdata2_Json.values = ['Data deleted.'] 
    }
    
  } catch (error) {
    console.log(error);
  } finally {
    db.close();
  }
  return sheetdata2_Json 
};

app.get('/api', async (req, res) => {
    res.json({id:'000', name: 'Backend Item'})    
  });

app.post('/', async (req, res) => {
    var myjson = req.body  // 
    // console.log(myjson);
    let sheetdata_Json  = await accessDB(myjson.command, myjson.payload);
    // setTimeout(()=>{
      res.json(sheetdata_Json)
    // },2000)
    ;
});

app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });


  
  