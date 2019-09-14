'use strict'
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
const axios = require('axios')
const {JSDOM} = require('jsdom')
const moment = require("moment-timezone")
const cache = require('./cache.js')
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

router.all('/matches/today', (_req, res) => {
  const todayDate = new Date()
  const koreanTodayDate = moment(todayDate.getTime()).tz("Asia/Seoul")
  const MatchDateStr = koreanTodayDate.format("YYYY-MM-DD")
  const club = 1
  const leagues = [1,99,2]
  let response = new chatbotResponse()

  cache.get('jbfc_match_by_date', MatchDateStr, () => getMatchByDateAndLeagues(leagues, club, todayDate))
  .then(match => {
    response.output(match.msg, [
      {
        "action": "block",
        "label": "라인업",
        "blockId": "5d7d48eeffa7480001c23697"
      }
    ]).context([{
      "name": "game",
      "lifeSpan": 1,
      "params": {
        "gs_idx": match.gs_idx.toString()
      }
    }])
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.output('오늘 경기가 없습니다')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/matches/next', (_req, res) => {
  const todayDate = new Date()
  const koreanTodayDate = moment(todayDate.getTime()).tz("Asia/Seoul")
  const MatchDateStr = koreanTodayDate.format("YYYY-MM-DD")
  const club = 1
  const leagues = [1,99,2]
  let response = new chatbotResponse()

  cache.get('jbfc_next_match_by_date', MatchDateStr, () => getNextMatchByDateAndLeagues(leagues, club, todayDate))
  .then(match => {
    response.output(match.msg, [
      {
        "action": "block",
        "label": "라인업",
        "blockId": "5d7d48eeffa7480001c23697"
      }
    ]).context([{
      "name": "game",
      "lifeSpan": 1,
      "params": {
        "gs_idx": match.gs_idx.toString()
      }
    }])
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.output('경기 일정이 없습니다')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/matches/last', (_req, res) => {
  const todayDate = new Date()
  const koreanTodayDate = moment(todayDate.getTime()).tz("Asia/Seoul")
  const MatchDateStr = koreanTodayDate.format("YYYY-MM-DD")
  const club = 1
  const leagues = [1,99,2]
  let response = new chatbotResponse()

  cache.get('jbfc_last_match_by_date', MatchDateStr, () => getLastMatchByDateAndLeagues(leagues, club, todayDate))
  .then(match => {
    response.output(match.msg, [
      {
        "action": "block",
        "label": "라인업",
        "blockId": "5d7d48eeffa7480001c23697"
      }
    ]).context([{
      "name": "game",
      "lifeSpan": 1,
      "params": {
        "gs_idx": match.gs_idx.toString()
      }
    }])
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.output('지난 경기가 없습니다')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/lineup', (req, res) => {
  const gsIdx = req.body.action.params.gs_idx
  let response = new chatbotResponse()
  
  cache.get('jbfc_lineup_by_gsidx', gsIdx.toString(), () => getLineUpByGsIdx(gsIdx))
  .then(lineup => response.output(lineup.msg))
  .catch(reason => {
    switch(reason){
      case 'no_lineup':
        response.output('라인업이 공개되지 않았습니다.')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/matches/:gs_idx/lineup/:team_class', (req, res) => {
  const gsIdx = req.params['gs_idx']
  const teamClass = req.params['team_class']
  let response = new chatbotResponse()

  cache.get('lineup_by_gsidx_'+teamClass, gsIdx.toString(), () => getLineUpByGsIdxAndTeam(gsIdx, teamClass))
  .then(lineup => response.output(lineup.msg))
  .catch(reason => {
    switch(reason){
      case 'no_lineup':
        response.output('라인업이 공개되지 않았습니다.')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
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
  const day = koreanMatchDate.format("DD")
  const koreanMatchDateTimestamp = (new Date(year+'-'+month+'-'+day+'T'+'23:59:59+09:00')).getTime()
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
      return Array.prototype.filter.apply(matchDocs, [(dayDoc) => dayDocToTimestamp(dayDoc) > koreanMatchDateTimestamp])
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
  const day = koreanMatchDate.format("DD")
  const koreanMatchDateTimestamp = (new Date(year+'-'+month+'-'+day+'T'+'00:00:00+09:00')).getTime()
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
      return Array.prototype.filter.apply(matchDocs, [(dayDoc) => dayDocToTimestamp(dayDoc) < koreanMatchDateTimestamp])
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

function getLineUpByGsIdx(gsIdx) {
  const url = 'http://www.kleague.com/match?vw=history&gs_idx=' + gsIdx
  return axios.get(url)
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => {
    let team
    if(doc.querySelectorAll('table.lineup-head th')[0].querySelector('span.name').textContent == '전북') {
      team = 'homeLineUp'
    } else {
      team = 'awayLineUp'
    }
    return [team, doc]
  })
  .then(([team, doc]) => [team, doc.querySelectorAll('div.lineup-body > ul')])
  .then(([team, lineUpBodyDocs]) => {
    if(lineUpBodyDocs.length > 0) {
      const lineUpDocs = domToArray(lineUpBodyDocs)
      const gkLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('gk'))[0]
      const dfLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('df'))[0]
      const mfLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('mf'))[0]
      const fwLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('fw'))[0]
      const gkPlayers = lineUpDocToPlayerNames(gkLineUpDoc, team).filter(name => name != '').map(name => 'GK. '+name).join('\n')
      const dfPlayers = lineUpDocToPlayerNames(dfLineUpDoc, team).filter(name => name != '').map(name => 'DF. '+name).join('\n')
      const mfPlayers = lineUpDocToPlayerNames(mfLineUpDoc, team).filter(name => name != '').map(name => 'MF. '+name).join('\n')
      const fwPlayers = lineUpDocToPlayerNames(fwLineUpDoc, team).filter(name => name != '').map(name => 'FW. '+name).join('\n')
      return {msg: [gkPlayers, dfPlayers, mfPlayers, fwPlayers].join('\n\n')}
    } else {
      return Promise.reject('no_lineup')
    }
  })
}

function getLineUpByGsIdxAndTeam(gsIdx, team) {
  const url = 'http://www.kleague.com/match?vw=history&gs_idx=' + gsIdx
  const teamClass = team == 'home' ? 'homeLineUp' : 'awayLineUp'
  return axios.get(url)
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => doc.querySelectorAll('div.lineup-body > ul'))
  .then(lineUpBodyDocs => {
    if(lineUpBodyDocs.length > 0) {
      const lineUpDocs = domToArray(lineUpBodyDocs)
      const gkLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('gk'))[0]
      const dfLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('df'))[0]
      const mfLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('mf'))[0]
      const fwLineUpDoc = lineUpDocs.filter(d => d.getAttribute('class').split(' ').includes('fw'))[0]
      const gkPlayers = lineUpDocToPlayerNames(gkLineUpDoc, teamClass).filter(name => name != '').map(name => 'GK. '+name).join('\n')
      const dfPlayers = lineUpDocToPlayerNames(dfLineUpDoc, teamClass).filter(name => name != '').map(name => 'DF. '+name).join('\n')
      const mfPlayers = lineUpDocToPlayerNames(mfLineUpDoc, teamClass).filter(name => name != '').map(name => 'MF. '+name).join('\n')
      const fwPlayers = lineUpDocToPlayerNames(fwLineUpDoc, teamClass).filter(name => name != '').map(name => 'FW. '+name).join('\n')
      return {msg: [gkPlayers, dfPlayers, mfPlayers, fwPlayers].join('\n\n')}
    } else {
      return Promise.reject('no_lineup')
    }
  })
}

function parseDayDoc(dayDoc) {
  const round = dayDocToRound(dayDoc)
  const versus = dayDocToVersus(dayDoc)
  const broadcasting = dayDocToBroadcasting(dayDoc)
  const stadium = dayDocToStadium(dayDoc)
  const matchDate = dayDocToMatchDateStr(dayDoc)
  const gsIdx = dayDocToGSIdx(dayDoc)
  return {
    msg: [round, versus, broadcasting, stadium, matchDate].filter(v => v != null).join('\n'),
    gs_idx: gsIdx
  }
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

function dayDocToGSIdx(dayDoc) {
  const gsIdxBtn = dayDoc.querySelectorAll('td.btn-match button.btn_matchcenter')
  if(gsIdxBtn.length < 1) return null
  else return gsIdxBtn[0].getAttribute('gs_idx')
}

function lineUpDocToPlayerNames(lineUpDoc, teamClass) {
  return Array.prototype.map.apply(lineUpDoc.querySelectorAll('div.' + teamClass + ' span.name'), [playerNameDoc => playerNameDoc.textContent.trim()])
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

function chatbotResponse() {
  this.data = {
    "version": "2.0",
    "template": { "outputs": [] },
    "context": { "values": [] }
  }

  this.output = function (msg, buttons) {
    if (buttons == undefined) {
      this.data.template.outputs = [
        {
          "simpleText": {
            "text": msg
          }
        }
      ]
    } else {
      this.data.template.outputs = [
        {
          "basicCard": {
            "description": msg,
            "buttons": buttons
          }
        }
      ]
    }

    return this
  }

  this.context = function (values) {
    this.data.context.values = values
    return this
  }

  this.toBody = function() {
    return this.data
  }
}

// The aws-serverless-express library creates a server and listens on a Unix
// Domain Socket for you, so you can remove the usual call to app.listen.
// app.listen(3000)
app.use('/', router)

// Export your express server so you can import it in the lambda function.
module.exports = app
