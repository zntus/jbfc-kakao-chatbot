'use strict'
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
const axios = require('axios')
const {JSDOM} = require('jsdom')
const moment = require("moment-timezone")
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const app = express()
const router = express.Router()

app.set('view engine', 'pug')

router.use(cors())
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: true }))
router.use(awsServerlessExpressMiddleware.eventContext())

// NOTE: tests can't find the views directory without this
app.set('views', path.join(__dirname, 'views'))

router.get('/', (req, res) => {
  res.render('index', {
    apiUrl: req.apiGateway ? `https://${req.apiGateway.event.headers.Host}/${req.apiGateway.event.requestContext.stage}` : 'http://localhost:3000'
  })
})

router.all('/matches/today', (req, res) => {
  const todayDate = new Date()
  const club = 1
  const leagues = [1,99,2]
  let msg

  getMatchByDateAndLeagues(leagues, club, todayDate)
  .then(match => msg = match)
  .catch(reason => {
    switch(reason){
      case 'no_match':
        msg = '오늘 경기가 없습니다'
        break
      default :
        msg = '현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'
    }
  })
  .finally(() => {
    const responseBody = {
      "version": "2.0",
      "data": {
        "msg": msg
      }
    }
  
    res.status(200).send(responseBody)
  })
})

router.all('/matches/next', (req, res) => {
  const todayDate = new Date()
  const club = 1
  const leagues = [1,99,2]
  let msg

  getNextMatchByDateAndLeagues(leagues, club, todayDate)
  .then(match => msg = match)
  .catch(reason => {
    switch(reason){
      case 'no_match':
        msg = '경기 일정이 없습니다'
        break
      default :
        msg = '현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'
    }
  })
  .finally(() => {
    const responseBody = {
      "version": "2.0",
      "data": {
        "msg": msg
      }
    }
  
    res.status(200).send(responseBody)
  })
})

router.all('/matches/last', (req, res) => {
  const todayDate = new Date()
  const club = 1
  const leagues = [1,99,2]
  let msg

  getLastMatchByDateAndLeagues(leagues, club, todayDate)
  .then(match => msg = match)
  .catch(reason => {
    switch(reason){
      case 'no_match':
        msg = '지난 경기가 없습니다'
        break
      default :
        msg = '현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'
    }
  })
  .finally(() => {
    const responseBody = {
      "version": "2.0",
      "data": {
        "msg": msg
      }
    }
  
    res.status(200).send(responseBody)
  })
})


function getMatchByDate(leagueNum, clubNum, matchDate) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const matchDay = koreanMatchDate.format("YYYY-MM-DD")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const url = 'http://www.kleague.com/schedule/get_lists?datatype=html&select_league_year='+year+'&month='+month+'&select_club='+clubNum+'&select_league='+leagueNum
  return axios.get(url)
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => Array.prototype.filter.apply(doc.querySelectorAll('table.table'), [(dayDoc) => dayDoc.id == matchDay]))
  .then(matchDocs => {
    if(matchDocs.length > 0) {
      return parseDayDoc(matchDocs[0])
    } else {
      return Promise.reject('no_match')
    }
  })
}

function getMatchByDateAndLeagues(leagueNums, clubNum, matchDate) {
  if(leagueNums.length < 1) {
    return Promise.reject('no_match')
  } else {
    return getMatchByDate(leagueNums[0], clubNum, matchDate)
    .catch(reason => {
      if(reason == 'no_match') 
        return getMatchByDateAndLeagues(leagueNums.slice(1), clubNum, matchDate)
      else
        return Promise.reject(reason)
    })
  }
}

function getNextMatchByDateAndLeagues(leagueNums, clubNum, matchDate) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const url = 'http://www.kleague.com/schedule/get_lists?datatype=html&select_league_year='+year+'&month='+month+'&select_club='+clubNum
  return Promise.all(leagueNums.map(league => url+'&select_league='+league).map(u => axios.get(u)))
  .then(res => res.map(r => new JSDOM(r.data)))
  .then(docs => docs.map(doc => doc.window.document))
  .then(docs => docs.map(doc => doc.querySelectorAll('table.table')))
  .then(docs => Array.prototype.concat.apply([], docs.map(doc => domToArray(doc))))
  .then(matchDocs => {
    return matchDocs.sort((a,b) => dayDocToTimestamp(a)-dayDocToTimestamp(b))
  })
  .then(matchDocs => {
    if(matchDocs.length < 1) {
      return Promise.reject('no_match')
    } else {
      return Array.prototype.filter.apply(matchDocs, [(dayDoc) => (new Date(dayDocToTimestamp(dayDoc))) > matchDate])
    }
  })
  .then(matchDocs => {
    if(matchDocs.length < 1) { 
      return getNextMatchByDateAndLeagues(leagueNums, clubNum, nextMonthFirstDate(matchDate))
    } else {
      return parseDayDoc(matchDocs[0])
    }
  })
}

function getLastMatchByDateAndLeagues(leagueNums, clubNum, matchDate) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const url = 'http://www.kleague.com/schedule/get_lists?datatype=html&select_league_year='+year+'&month='+month+'&select_club='+clubNum
  return Promise.all(leagueNums.map(league => url+'&select_league='+league).map(u => axios.get(u)))
  .then(res => res.map(r => new JSDOM(r.data)))
  .then(docs => docs.map(doc => doc.window.document))
  .then(docs => docs.map(doc => doc.querySelectorAll('table.table')))
  .then(docs => Array.prototype.concat.apply([], docs.map(doc => domToArray(doc))))
  .then(matchDocs => {
    return matchDocs.sort((a,b) => dayDocToTimestamp(b)-dayDocToTimestamp(a))
  })
  .then(matchDocs => {
    if(matchDocs.length < 1) {
      return Promise.reject('no_match')
    } else {
      return Array.prototype.filter.apply(matchDocs, [(dayDoc) => (new Date(dayDocToTimestamp(dayDoc))) < matchDate])
    }
  })
  .then(matchDocs => {
    if(matchDocs.length < 1) { 
      return getLastMatchByDateAndLeagues(leagueNums, clubNum, previousMonthLastDate(matchDate))
    } else {
      return parseDayDoc(matchDocs[0])
    }
  })
}

function parseDayDoc(dayDoc) {
  const round = dayDocToRound(dayDoc)
  const versus = dayDocToVersus(dayDoc)
  const broadcasting = dayDocToBroadcasting(dayDoc)
  const stadium = dayDocToStadium(dayDoc)
  const matchDate = dayDocToMatchDateStr(dayDoc)
  return [round, versus, broadcasting, stadium, matchDate].filter(v => v != null).join('\n')
}

function dayDocToRound(dayDoc) {
  return dayDoc.querySelectorAll('td')[0].textContent.match(/[0-9]*R/)
}

function dayDocToVersus(dayDoc) {
  const clubs = Array.prototype.map.apply(dayDoc.querySelectorAll('span.club'), [(clubDoc) => clubDoc.innerHTML]).join(' vs ')
  const isDone = dayDoc.querySelectorAll('tbody tr')[0].id.match(/[0-9-]*y/)
  if(isDone == null) {
    return clubs
  } else {
    const score = dayDoc.querySelector('td.team-match div.score').textContent
    return clubs + ' (' + score + ')'
  }
}

function dayDocToStadium(dayDoc) {
  const stadium = dayDoc.querySelectorAll('td')[3].textContent.trim()
  if(stadium == '') return null
  else return stadium
}

function dayDocToBroadcasting(dayDoc) {
  const broadcasting = dayDoc.querySelectorAll('td')[2].textContent.trim()
  if(broadcasting == '') return 'TV중계: 없음'
  else return 'TV중계: ' + broadcasting
}

function dayDocToTimestamp(dayDoc) {
  return parseInt(dayDoc.querySelector('tr td.col-rd div').textContent.split('::')[1]+'000')
}

function dayDocToMatchDateStr(dayDoc) {
  const koreanMatchDate = moment((new Date(dayDocToTimestamp(dayDoc))).getTime()).tz("Asia/Seoul")
  return koreanMatchDate.format("YYYY-MM-DD HH:mm")
}

function domToArray(dom) {
  var arr = []
  dom.forEach(e => arr.push(e))
  return arr
}

function nextMonthFirstDate(date) {
  const month = (date.getMonth()+1)%12
  const year = date.getFullYear() + Math.floor((date.getMonth()+1)/12)
  return new Date(year, month, 1, 0)
}

function previousMonthLastDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1-1, 0)
}

// The aws-serverless-express library creates a server and listens on a Unix
// Domain Socket for you, so you can remove the usual call to app.listen.
// app.listen(3000)
app.use('/', router)

// Export your express server so you can import it in the lambda function.
module.exports = app
