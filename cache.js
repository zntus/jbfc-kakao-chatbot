'use strict'
const DDB_TABLE_NAME = "JBFCCache"
const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10', region: 'ap-northeast-2'})

exports.get = (cacheType, cacheKey, funValue, funExpireAt) => {
  return getCacheDataFromDDB(cacheType, cacheKey)
  .then(item => {
    if(item == undefined) {
      return Promise.reject('not_found')
    } else if (item['expire_at'] < dateToEpochTime(new Date())) {
      return Promise.reject('expired')
    } else {
      return JSON.parse(item['value'])
    }
  })
  .catch(err => {
    if(err == 'not_found' || err == 'expired') {
      const funExpire = funExpireAt || defaultExpireAt
      return funValue()
      .then(value => {
        if(value == undefined || value == null){
          return value
        } else {
          return funExpire()
          .then(expireAt => {
            const valueStr = JSON.stringify(value)
            setCacheDataToDDB(cacheType, cacheKey, valueStr, expireAt)
            return value
          })
        }
      })
    } else {
      return Promise.reject(err)
    }
  })
}

function getCacheDataFromDDB(cacheType, cacheKey) {
  const params = {
    Key: {
      "cache_type": {S: cacheType},
      "cache_key": {S: cacheKey}
    },
    TableName: DDB_TABLE_NAME
  }

  return new Promise(function(resolve, reject) {
    dynamodb.getItem(params, function(err, data) {
      if (err) { 
        console.log(err, err.stack)
        reject(err)
      } else {
        resolve(DDBItemToObj(data['Item']))
      }
    })
  })
}

function setCacheDataToDDB(cacheType, cacheKey, valueStr, expireAt) {
  const expireAtInEpochTime = dateToEpochTime(expireAt)
  const params = {
    Item: {
      "cache_type": {S: cacheType},
      "cache_key": {S: cacheKey},
      "value": {S: valueStr},
      "expire_at": {N: expireAtInEpochTime.toString()}
    }, 
    ReturnConsumedCapacity: "NONE", 
    TableName: DDB_TABLE_NAME
   }

   return new Promise(function(resolve, reject) {
    dynamodb.putItem(params, function(err, _data) {
      if (err) { 
        console.log(err, err.stack)
        reject(err)
      } else {
        resolve(DDBItemToObj(params['Item']))
      }
    })
  })
} 

function DDBItemToObj(item) {
  if(item == undefined) return undefined
  if(item == null) return undefined
  return Object.keys(item).reduce((acc, k) => {
    const t = (Object.keys(item[k]))[0]
    switch(t) {
      case 'S' : 
        acc[k] = item[k][t]  
        break;
      case 'N' :
        acc[k] = parseInt(item[k][t])
        break;
      default :
        acc[k] = item[k][t]  
    }
    return acc
  }, {})
}

function ObjToDDBItem(obj) {
  return Object.keys(obj).reduce((acc, k) => {
    acc[k] = item[k] = {S: obj[k]}
    return acc
  }, {})
}

function dateToEpochTime(date) {
  return Math.floor(date.getTime() / 1000)
}

function epochTimeToDate(epochTime) {
  return new Date(epochTime*1000)
}

function defaultExpireAt() {
  let now = new Date()
  now.setHours(now.getHours() + 24)
  return Promise.resolve(now)
}