const axios = require('axios')
const {JSDOM} = require('jsdom')
const moment = require("moment-timezone")
const querystring = require('querystring')
const cache = require('./cache.js')

exports.getMatch = (clubName, matchDate) => {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const date = koreanMatchDate.format("YYYYMMDD")
  return cache.get('today-match-'+clubName, date, () => _getMatch(clubName, matchDate)) 
}

function _getMatch(clubName, matchDate) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const day = koreanMatchDate.format("DD")
  const url = 'http://portal.kleague.com/view/schedule/list.do'
  const param = {
    selectYear: year,
    selectMonth: month
  }

  return axios.post(url, querystring.stringify(param))
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => {
    const clubDocs = [].concat.apply([], 
      domToArray(doc.querySelectorAll('div.full-calendar-title'))
      .filter(e => 
        e.querySelector('span.taL.pl5') != null && 
        !e.querySelector('span.taL.pl5').getAttribute('class').split(' ').includes('gray') && 
        e.querySelector('span.taL.pl5').textContent == day
      ).map(e => domToArray(e.querySelectorAll('div.full-calendar-data-k1, div.full-calendar-data-k2, div.full-calendar-data-k5')))
    )
    .filter(e => 
      e.querySelectorAll('span.flL.pl5').length > 0 &&
      e.querySelectorAll('span.flL.pl5')[0].textContent.indexOf(clubName) >= 0
    )

    if(clubDocs.length < 1) {
      return Promise.reject('no_match')
    } else {
      return parseClub(clubDocs[0])
    }
  })
}

exports.getNextMatch = (clubName, matchDate) => {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const date = koreanMatchDate.format("YYYYMMDD")
  return cache.get('next-match-'+clubName, date, () => _getNextMatch(clubName, matchDate)) 
}

function _getNextMatch(clubName, matchDate, count = 1) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const day = koreanMatchDate.format("DD")
  const url = 'http://portal.kleague.com/view/schedule/list.do'
  const param = {
    selectYear: year,
    selectMonth: month
  }

  return axios.post(url, querystring.stringify(param))
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => {
    const clubDocs = [].concat.apply([], 
      domToArray(doc.querySelectorAll('div.full-calendar-title'))
      .filter(e => 
        e.querySelector('span.taL.pl5') != null && 
        !e.querySelector('span.taL.pl5').getAttribute('class').split(' ').includes('gray') && 
        parseInt(e.querySelector('span.taL.pl5').textContent) > parseInt(day)
      ).map(e => domToArray(e.querySelectorAll('div.full-calendar-data-k1, div.full-calendar-data-k2, div.full-calendar-data-k5')))
    )
    .filter(e => 
      e.querySelectorAll('span.flL.pl5').length > 0 &&
      e.querySelectorAll('span.flL.pl5')[0].textContent.indexOf(clubName) >= 0
    )

    if(clubDocs.length < 1) {
      if(count <= 0)
        return Promise.reject('no_match')
      else
        return _getNextMatch(clubName, nextMonthFirstDate(matchDate), count-1)
    } else {
      return parseClub(clubDocs[0])
    }
  })
}

exports.getLastMatch = (clubName, matchDate) => {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const date = koreanMatchDate.format("YYYYMMDD")
  return cache.get('last-match-'+clubName, date, () => _getLastMatch(clubName, matchDate)) 
}

function _getLastMatch(clubName, matchDate, count = 1) {
  const koreanMatchDate = moment(matchDate.getTime()).tz("Asia/Seoul")
  const year = koreanMatchDate.format("YYYY")
  const month = koreanMatchDate.format("MM")
  const day = koreanMatchDate.format("DD")
  const url = 'http://portal.kleague.com/view/schedule/list.do'
  const param = {
    selectYear: year,
    selectMonth: month
  }

  return axios.post(url, querystring.stringify(param))
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => {
    const clubDocs = [].concat.apply([], 
      domToArray(doc.querySelectorAll('div.full-calendar-title'))
      .filter(e => 
        e.querySelector('span.taL.pl5') != null && 
        !e.querySelector('span.taL.pl5').getAttribute('class').split(' ').includes('gray') && 
        parseInt(e.querySelector('span.taL.pl5').textContent) < parseInt(day)
      ).map(e => domToArray(e.querySelectorAll('div.full-calendar-data-k1, div.full-calendar-data-k2, div.full-calendar-data-k5')))
    )
    .filter(e => 
      e.querySelectorAll('span.flL.pl5').length > 0 &&
      e.querySelectorAll('span.flL.pl5')[0].textContent.indexOf(clubName) >= 0
    )

    if(clubDocs.length < 1) {
      if(count <= 0)
        return Promise.reject('no_match')
      else
        return _getLastMatch(clubName, previousMonthLastDate(matchDate), count-1)
    } else {
      return parseClub(clubDocs[clubDocs.length-1])
    }
  })
}

exports.getLineUp = (clubName, matchYear, gameId) => {
  return cache.get('lineup-' + clubName, matchYear + '-' + gameId, () => _getLineUp(clubName, matchYear, gameId)) 
}

function _getLineUp(clubName, matchYear, gameId) {
  const url = 'http://portal.kleague.com/mainFrame.do'
  const param = {
    selectedMenuCd: '0301',
    mainMeetYear: matchYear,
    mainGameId: gameId
  }

  if (gameId == null || gameId == undefined) {
    return Promise.reject('no_game_id')
  } else {
    return getSession()
    .then(session => axios.post(url, querystring.stringify(param), {headers: {'Cookie': session}}))
    .then(res => new JSDOM(res.data))
    .then(doc => doc.window.document)
    .then(doc => {
      const home = doc.querySelector('#btnHomeTeam')
      const away = doc.querySelector('#btnAwayTeam')
      let playerDocs;

      if (home == null || away == null) {
        return Promise.reject('no_lineup')
      } else if (home.textContent == clubName) {
        playerDocs = domToArray(doc.querySelectorAll('#ulHomeList li'))
      } else if (away.textContent == clubName) {
        playerDocs = domToArray(doc.querySelectorAll('#ulAwayList li'))
      }

      return playerDocs.map(e => {
        return {
          number: parseInt(e.querySelector('span.match-live-txt').textContent),
          position: e.querySelector('span.match-live-txt03').textContent,
          name: e.querySelector('span.match-live-txt02').textContent,
        }
      })
    })
  }
}

exports.getReferees = (matchYear, gameId) => {
  return cache.get('referees', matchYear + '-' + gameId, () => _getReferees(matchYear, gameId)) 
}

function _getReferees(matchYear, gameId) {
  const url = 'http://portal.kleague.com/mainFrame.do'
  const param = {
    selectedMenuCd: '0301',
    mainMeetYear: matchYear,
    mainGameId: gameId
  }

  if (gameId == null || gameId == undefined) {
    return Promise.reject('no_game_id')
  } else {
    return getSession()
    .then(session => axios.post(url, querystring.stringify(param), {headers: {'Cookie': session}}))
    .then(res => new JSDOM(res.data))
    .then(doc => doc.window.document)
    .then(doc => {
      const data = doc.querySelectorAll('div.match-prame-box li')
      if (data.length < 5) {
        return Promise.reject('no_referees')
      } else {
        const mainReferee = data[4].querySelectorAll('span')[1].textContent.trim()
        const referees = data[4].querySelectorAll('span')[1].getAttribute('title').split('\r')
        if(mainReferee == '') {
          return Promise.reject('no_referees')
        } else {
          return ['주심 : '+mainReferee].concat(referees).join('\n')
        }
      }
    })
  }
}

exports.getRanking = (leagueNum, rankingDate) => {
  const koreanMatchDate = moment(rankingDate.getTime()).tz("Asia/Seoul")
  const date = koreanMatchDate.format("YYYYMMDD")
  return cache.get('league-'+leagueNum+'-ranking', date, () => _getRanking(leagueNum, rankingDate)) 
}

function _getRanking(leagueNum, rankingDate) {
  const url = 'http://portal.kleague.com/common/search/change.do'
  const koreanMatchDate = moment(rankingDate.getTime()).tz("Asia/Seoul")
  const searchYear = koreanMatchDate.format("YYYY")
  const searchDate = koreanMatchDate.format("YYYY/MM/DD")
  const league = {
    1: '2',
    2: '3'
  }

  const commonvostr = {
    "menuVo":{
      "menuCd":"0041",
      "uriPath":"data/offi/",
      "chartYn":"N"
    },
    "searchVo":{
      "searchDate": searchDate,
      "selectMeetYear": searchYear
    },
    "menuCodeVo":{
      "menuCd":"0041",
      "leagueId": league[leagueNum],
      "workCode":"S"
    }
  }
  
  const param = {commonvostr: JSON.stringify(commonvostr)}

  return axios.post(url, querystring.stringify(param))
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => eval(doc.querySelectorAll('script')[5].textContent.match(/var jsonResultData = (.*)/i)[1])[0])
}

exports.matchToString = (club) => {
  const score = club.score == undefined ? '' : ' ('+club.score+')'
  return [
    club.league, 
    club.home + ' vs ' + club.away + score,
    'TV중계: ' + club.broadcasting,
    club.stadium,
    club.date + ' ' + club.time
  ].join('\n')
}

exports.lineUpToString = (lineUp) => {
  return [
    lineUp.filter(p => p.position == 'GK').map(p => playerToString(p)).join('\n'),
    lineUp.filter(p => p.position == 'DF').map(p => playerToString(p)).join('\n'),
    lineUp.filter(p => p.position == 'MF').map(p => playerToString(p)).join('\n'),
    lineUp.filter(p => p.position == 'FW').map(p => playerToString(p)).join('\n')
  ].join('\n\n')
}

exports.rankingToString = (leagueNum, ranking) => {
  const ranks = ranking.map(rank => teamRankToString(rank))
  const group1 = leagueNum == 1 ? ranks.slice(0,3) : ranks.slice(0,1)
  const group2 = leagueNum == 1 ? ranks.slice(3,10) : ranks.slice(1,3)
  const group3 = leagueNum == 1 ? ranks.slice(10,12) : ranks.slice(3,10)
  return [group1.join('\n'), group2.join('\n'), group3.join('\n')].join('\n\n')
}

function playerToString(player) {
  return player.position + '. ' + player.number.toString().padStart(2, '0') + '. ' + player.name
}

function teamRankToString(rank) {
  return rank['Rank'].toString().padStart(2, '0') + '. ' + rank['Team_Name'] + ' (경기수: ' + rank['Game_Count']+', 승점: ' + rank['Gain_Point'] + ')'
}

function getSession() {
  return cache.get('session', 'data.kleague.com', _getSession) 
}

function _getSession() {
  const url = 'http://data.kleague.com/'
  return axios.get(url)
  .then(res => new JSDOM(res.data))
  .then(doc => doc.window.document)
  .then(doc => doc.querySelectorAll('frame')[1].getAttribute('src'))
  .then(loginUrl => axios.get(loginUrl, {maxRedirects: 0}))
  .catch(res => { 
    if (res.status = 302) {
      return Promise.resolve(res.response.headers['set-cookie'].join(';').replace(/JSESSIONID=([A-Z0-9]+)(;.*)/, 'JSESSIONID=$1'))
    }
  })
}

function domToArray(dom) {
  var arr = []
  dom.forEach(e => arr.push(e))
  return arr
}

function parseClub(clubDoc) {
  let scoreStr = undefined
  const jsStr = clubDoc.querySelectorAll('span')[0].getAttribute('onmouseover')
  const fsStr = 'function ddrivetip(league, gameid, home, away, date, time, stadium, broadcasting) {  \
          return { \
            league: league,  \
            gameid: gameid,  \
            home: home, \
            away: away, \
            date: date,  \
            time: time, \
            stadium: stadium, \
            broadcasting: broadcasting.replace("<BR/>", "")\
          }\
        }'
  if (clubDoc.querySelector('span.flR.pr5').textContent.trim().match(/\([0-9]+:[0-9]+\)/)) {
    scoreStr = clubDoc.querySelector('span.flR.pr5').textContent.trim().replace(/\(([0-9]+):([0-9]+)\)/, '$1:$2')
  }
  return Object.assign({}, eval(fsStr + '\n' + jsStr), { score: scoreStr })
}

function nextMonthFirstDate(date) {
  const month = (date.getMonth()+1)%12
  const year = date.getFullYear() + Math.floor((date.getMonth()+1)/12)
  return new Date(year, month, 1, 0)
}

function previousMonthLastDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1-1, 0)
}