function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function doPost(e) {
  try {
//------------UNCOMMENT TO START QUERYING FROM FRONTEND--------
    const jsonString = e.postData.contents;
    if (!jsonString) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: 'No JSON data provided' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const jsonData = JSON.parse(jsonString);
      
//----------------DUMMY CRUD JSONS FROM FRONTEND----------------
//--------------------FOR DEVELOPMENT ONLY----------------------
    // const jsonData = {command: 'auth',payload: { enterName: 'Suresh Reddy',enterPhone:'9123456789',password:'12345',newUser: false }}
    // const jsonData = {command: 'read',payload: { currentrow:0,filterby:{city:'',locality:'',type:''},range:{pricefrom:'20000',priceto:''} }}   
    // const jsonData = {command: 'read',payload: { currentrow:0,filterby:'',range:'' }}    
//-----------------------------------------------------------
    var values = [] 
    const payload = jsonData.payload       
    const timestamp = Date.now();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
    
    const lock = LockService.getScriptLock();
    const cache = CacheService.getPublicCache();

    const scriptProperties = PropertiesService.getScriptProperties();
    const visitorCount = scriptProperties.getProperty('Visitors');
    Logger.log(`Visitors : ${visitorCount}`)
    scriptProperties.setProperty('Visitors',`${Number(visitorCount)+1}`);

// ----------------------------------------------------------
    if(jsonData.command == 'auth'){   
      const enterName = payload.enterName
      const enterPhone = payload.enterPhone
      const password = payload.password
      const newUser = payload.newUser

      const authsheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auth');

      var cachedData = cache.get('authdata')
      if(cachedData){
        Logger.log('Returning Cached values')
        values = JSON.parse(cachedData)        
      }else{
        Logger.log('Fetch sheet values')
        lock.waitLock(5000);
        values = authsheet.getDataRange().getValues();
        lock.releaseLock();
        const jsonString = JSON.stringify(values)
        Logger.log(jsonString) 
        const sizeInKB = (Utilities.newBlob(jsonString).getBytes().length/1024).toFixed(3);
        Logger.log(sizeInKB) 
        scriptProperties.setProperty('AuthDataCacheSize',`${sizeInKB} KB`);
        cache.put('authdata',jsonString,600) // 10 minutes
      }
      Logger.log(values) // contains header

      if(newUser){
        const newrow = [[enterName,enterPhone,password,timestamp]]
        const hasValue = values.some(e=>e[0]==enterName && e[1]==enterPhone && e[2]==password)
        if(hasValue){
          Logger.log('Already exists')
          values = ['User Already exists']
        }else{
          lock.waitLock(5000);
          authsheet.getRange(authsheet.getLastRow()+1, 1, 1, 4).setValues(newrow);          
          values = authsheet.getDataRange().getValues();
          lock.releaseLock();
          const jsonString = JSON.stringify(values)
          cache.put('authdata',jsonString,600) // 10 minutes
          Logger.log('Account Added')
          values = ['User Account Added']
        }              
      }else{          
        var matchdata = values.filter(arr => arr[0]==enterName || arr[1]==enterPhone || arr[2]==password)
        Logger.log(matchdata)
        if(matchdata.length == 1){          
          values = ['Verified']           
        }else{
          values = ['Not Verified']
        } 
      } 
    }
// ----------------------------------------------------------------   
//-----------------------------------------------------------------  
    if(jsonData.command == 'read'){      
      const filterby = payload.filterby 
      const range = payload.range 
      const currentRow = payload.currentrow   

      const rowspercachekey = 250   
      let counter = 0;      
      counter = Math.floor(currentRow/rowspercachekey);         

      if(filterby == '' && range == ''){  
        //Implement cache to reduce the number of API calls to Sheet 
        const cachedData = cache.get(`getall:${counter}`)       
        if(cachedData){ 
          Logger.log('Cached sheet values')         
          values = JSON.parse(cachedData)
          const cacheRows = values.length 
          Logger.log(`Cache Rows: ${cacheRows}`)  
        }else{          
          Logger.log('Fetch sheet values')
          lock.waitLock(5000);
          values = sheet.getDataRange().getValues();
          lock.releaseLock();
          const totalRows = values.length - 1
          Logger.log(`Total Rows: ${totalRows}`)  
          counter = 0;         
          for(let i=0; i < totalRows; i += rowspercachekey){
            const prop = values.slice(i+1, i+1 + rowspercachekey);
            prop.push(totalRows)
            const key = `getall:${counter}`
            cache.put(key, JSON.stringify(prop),600)
            Logger.log(`Key created := ${key}`)
            counter += 1;
          } 
          counter = 0; 
          const cachedData = cache.get(`getall:${counter}`) 
          values = JSON.parse(cachedData)
        }        
      }else{ 
        const cachedData = cache.get(`filter:${JSON.stringify(filterby)}:${JSON.stringify(range)}:${counter}`)
        if(cachedData){   
          Logger.log('Returning Filter Cached values')        
          values = JSON.parse(cachedData)
          const cachefilterRows = values.length 
          Logger.log(`Cache filter Rows: ${cachefilterRows}`)  
        }else{
          var condtn = '' 
          const colname = {locality:'E',city:'F',ownername:'G',rentalprice:'I',type:'K'} 

          if(filterby != ''){        
            const keys = Object.keys(filterby)       
            var first = true
            Logger.log(keys)
            for(let i=0; i<keys.length; i++){
              if(filterby[keys[i]] != ''){
                if(first == true){
                  condtn = `${colname[keys[i]]}=\'${filterby[keys[i]]}\'`
                  first = false
                }else{
                  condtn = `${condtn} and ${colname[keys[i]]}=\'${filterby[keys[i]]}\'`
                }          
              }
            }
            Logger.log('Filters loop Done')
          }               
          
          if(range != ''){
            if(range.pricefrom != ''){
              if(condtn != ''){
                condtn = `${condtn} and ${colname.rentalprice}>\'${range.pricefrom}\'`
              }else{
                condtn = `${colname.rentalprice}>\'${range.pricefrom}\'`
              }
            }
            if(range.priceto != ''){
              if(condtn != ''){
                condtn = `${condtn} and ${colname.rentalprice}<\'${range.priceto}\'`
              }else{
                condtn = `${colname.rentalprice}<\'${range.priceto}\'`
              }
            }            
            Logger.log('Range loop done') 
          }       
         
          const query = `=QUERY(Sheet1!A:L, "SELECT * WHERE (${condtn})", 1)`    
          Logger.log(query)    

          lock.waitLock(10000);   
          const tempSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TempSheet")
          tempSheet.getRange("A1").setFormula(query);
          SpreadsheetApp.flush();
          values = tempSheet.getDataRange().getValues();
          lock.releaseLock();
          // tempSheet.getRange("A1").clearContent();

          const totalfilterRows = values.length - 1
          Logger.log(`Total Filter Rows: ${totalfilterRows}`)            
          counter = 0;         
          for(let i=0; i < totalfilterRows; i += rowspercachekey){
            const prop = values.slice(i+1, i+1 + rowspercachekey);
            prop.push(totalfilterRows)
            const key = `filter:${JSON.stringify(filterby)}:${JSON.stringify(range)}:${counter}`
            cache.put(key, JSON.stringify(prop),600)  
            Logger.log(`Filter Key created := ${key}`)
            counter += 1;
          } 
          counter = 0
          const cachedData = cache.get(`filter:${JSON.stringify(filterby)}:${JSON.stringify(range)}:${counter}`)
          values = JSON.parse(cachedData)                                 
        }        
      }      
    }
// -------------------------------------------------------------     
    if(jsonData.command == 'create'){   
      var toCreate = payload.toCreate
      lock.waitLock(5000);
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, toCreate.length).setValues([toCreate]);
      lock.releaseLock();
      values = ['Data created.']
      Logger.log('Data created.');
    }
//-------------------------------------------------------------- 
    if(jsonData.command == 'update'){      
      const updatedArray = payload.toUpdate
      const timestampID = updatedArray[0]
      lock.waitLock(5000);
      const range = sheet.getRange(2, 1, sheet.getLastRow(), 1);
      const finder = range.createTextFinder(timestampID);
      const foundCell = finder.findNext();
      if (foundCell) {
        const rowNumber = foundCell.getRow();
        foundCell.clearFormat(); 
        sheet.getRange(rowNumber, 1, 1, updatedArray.length).setValues([updatedArray]);
        values = ['Values updated.']
        Logger.log('Row values updated.');
      }else{
        values = ['Values not updated.']
        Logger.log('Row values not updated.');
      }
      lock.releaseLock();      
    }
//-------------------------------------------------------------- 
    if(jsonData.command == 'delete'){   
      const rowId = payload.toDeleteID; 
      lock.waitLock(5000);
      const range = sheet.getRange(2, 1, sheet.getLastRow(), 1);
      const finder = range.createTextFinder(rowId);
      const foundCell = finder.findNext();
      if (foundCell) {
        const rowNumber = foundCell.getRow(); 
        foundCell.clearFormat();       
        sheet.deleteRow(rowNumber);
        values = ['Data deleted.']
        Logger.log('Row deleted.');
      }else{
        values = ['Data not deleted.']
        Logger.log('Row not deleted.');
      }
      lock.releaseLock(); 
    }
//-------------------------------------------------------------- 
    // Logger.log('Final Response:');    
    // const response = JSON.stringify({ values: values })
    // Logger.log(response);
//-------------------------------------------------------------- 
    return ContentService.createTextOutput(
      JSON.stringify({ values: values }))
    .setMimeType(ContentService.MimeType.JSON);    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
