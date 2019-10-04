'use strict'
const JBFC_TEAM_ID = 'K05'
const JBFC_TEAM_NAME = '전북'
const JBFC_LEAGUE_NUM = 1

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
const moment = require("moment-timezone")
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const app = express()
const router = express.Router()
const kleague = require('./k-league.js')
const kakaoResponse = require('./kakao-template.js')

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
  let response = kakaoResponse.response()

  kleague.getMatch(JBFC_TEAM_NAME, new Date())
  .then(match => {
    response.appendOutput(
      kakaoResponse.basicCard()
      .setDescription(kleague.matchToString(match))
      .appendButton(
        kakaoResponse.button("라인업")
        .setAction('block')
        .setBlockId('5d7d48eeffa7480001c23697')
      )
      .appendButton(
        kakaoResponse.button("심판")
        .setAction('block')
        .setBlockId('5d86b373ffa74800015154be')
      )
      .appendButton(
        kakaoResponse.button("하이라이트")
        .setAction('block')
        .setBlockId('5d94abbb92690d0001a42fe1')
      )
    ).appendContext(
      kakaoResponse.context('game')
      .setLifeSpan(5)
      .addParam('game_id', match.gameid.toString())
    )
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.appendOutput(kakaoResponse.simpleText('오늘 경기가 없습니다'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/matches/next', (_req, res) => {
  let response = kakaoResponse.response()

  kleague.getNextMatch(JBFC_TEAM_NAME, new Date())
  .then(match => {
    response.appendOutput(
      kakaoResponse.simpleText(kleague.matchToString(match))
    ).appendContext(
      kakaoResponse.context('game')
      .setLifeSpan(5)
      .addParam('game_id', match.gameid.toString())
    )
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.appendOutput(kakaoResponse.simpleText('경기 일정이 없습니다'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/matches/last', (_req, res) => {
  let response = kakaoResponse.response()

  kleague.getLastMatch(JBFC_TEAM_NAME, new Date())
  .then(match => {
    response.appendOutput(
      kakaoResponse.basicCard()
      .setDescription(kleague.matchToString(match))
      .appendButton(
        kakaoResponse.button("라인업")
        .setAction('block')
        .setBlockId('5d7d48eeffa7480001c23697')
      )
      .appendButton(
        kakaoResponse.button("심판")
        .setAction('block')
        .setBlockId('5d86b373ffa74800015154be')
      )
      .appendButton(
        kakaoResponse.button("하이라이트")
        .setAction('block')
        .setBlockId('5d94abbb92690d0001a42fe1')
      )
    ).appendContext(
      kakaoResponse.context('game')
      .setLifeSpan(5)
      .addParam('game_id', match.gameid.toString())
    )
  })
  .catch(reason => {
    switch(reason){
      case 'no_match':
        response.appendOutput(kakaoResponse.simpleText('지난 경기가 없습니다'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/lineup', (req, res) => {
  const gameId = req.body.action.params.game_id
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = kakaoResponse.response()
  
  kleague.getLineUp(JBFC_LEAGUE_NUM, JBFC_TEAM_ID, matchYear, gameId)
  .then(lineup => 
    response
    .appendOutput(kakaoResponse.simpleText(kleague.lineUpToString(lineup)))
    .appendOutput(
      kakaoResponse.carousel(kakaoResponse.basicCard().getType())
      .appendItems(
        lineup.map(player => 
          kakaoResponse.basicCard()
          .setImage(player['profileImage'], true, 80, 101)
          .setTitle(kleague.playerToString(player))
          .appendButton(kakaoResponse.button('자세히 보기').setAction('webLink').setWebLinkUrl(player['link']))
        )
      )
    )
  )
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_lineup':
        response.appendOutput(kakaoResponse.simpleText('라인업이 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/matches/:game_id/lineup', (req, res) => {
  const gameId = req.params['game_id']
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = kakaoResponse.response()

  kleague.getLineUp(JBFC_LEAGUE_NUM, JBFC_TEAM_ID, matchYear, gameId)
  .then(lineup => 
    response
    .appendOutput(kakaoResponse.simpleText(kleague.lineUpToString(lineup)))
    .appendOutput(
      kakaoResponse.carousel(kakaoResponse.basicCard().getType())
      .appendItems(
        lineup.map(player => 
          kakaoResponse.basicCard()
          .setImage(player['profileImage'], true, 80, 101)
          .setTitle(kleague.playerToString(player))
          .appendButton(kakaoResponse.button('자세히 보기').setAction('webLink').setWebLinkUrl(player['link']))
        )
      )
    )
  )
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_lineup':
        response.appendOutput(kakaoResponse.simpleText('라인업이 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/referees', (req, res) => {
  const gameId = req.body.action.params.game_id
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = kakaoResponse.response()
  
  kleague.getReferees(matchYear, gameId)
  .then(referees => response.appendOutput(kakaoResponse.simpleText(referees)))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_referees':
        response.appendOutput(kakaoResponse.simpleText('심판이 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/matches/:game_id/referees', (req, res) => {
  const gameId = req.params['game_id']
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = kakaoResponse.response()

  kleague.getReferees(matchYear, gameId)
  .then(referees => response.appendOutput(kakaoResponse.simpleText(referees)))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_referees':
        response.appendOutput(kakaoResponse.simpleText('심판이 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/ranking/:league', (req, res) => {
  const leagueNum = req.params['league']
  let response = kakaoResponse.response()

  kleague.getRanking(leagueNum, new Date())
  .then(ranking => response.appendOutput(kakaoResponse.simpleText(kleague.rankingToString(leagueNum, ranking))))
  .catch(reason => {
    switch(reason){
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/matches/:game_id/highlight', (req, res) => {
  const gameId = req.params['game_id']
  let response = kakaoResponse.response()

  kleague.highlight(JBFC_LEAGUE_NUM, gameId)
  .then(res => 
    response.appendOutput(
      kakaoResponse.carousel(kakaoResponse.basicCard().getType())
      .appendItems(
        res.map(video => 
          kakaoResponse.basicCard()
          .setImage(video.image)
          .setTitle(video.title)
          .appendButton(
            kakaoResponse.button('영상 보기')
            .setAction('webLink')
            .setWebLinkUrl(video.video)
          )
        )
      )
    )
  )
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_highlight':
        response.appendOutput(kakaoResponse.simpleText('하이라이트가 아직 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

router.all('/highlight', (req, res) => {
  const gameId = req.body.action.params.game_id
  let response = kakaoResponse.response()
  
  kleague.highlight(JBFC_LEAGUE_NUM, gameId)
  .then(res => 
    response.appendOutput(
      kakaoResponse.carousel(kakaoResponse.basicCard().getType())
      .appendItems(
        res.map(video => 
          kakaoResponse.basicCard()
          .setImage(video.image)
          .setTitle(video.title)
          .appendButton(
            kakaoResponse.button('영상 보기')
            .setAction('webLink')
            .setWebLinkUrl(video.video)
          )
        )
      )
    )
  )
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.appendOutput(kakaoResponse.simpleText('어떤 경기에 대해 물어 보셨는지 모르겠어요.'))
        break
      case 'no_highlight':
        response.appendOutput(kakaoResponse.simpleText('하이라이트가 아직 공개되지 않았습니다.'))
        break
      default :
        console.log('Error: ', reason)
        response.appendOutput(kakaoResponse.simpleText('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.'))
    }
  })
  .finally(() => {
    res.status(200).send(response)
  })
})

// The aws-serverless-express library creates a server and listens on a Unix
// Domain Socket for you, so you can remove the usual call to app.listen.
// app.listen(3000)
app.use('/', router)

// Export your express server so you can import it in the lambda function.
module.exports = app
