'use strict'
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
const moment = require("moment-timezone")
const cache = require('./cache.js')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const app = express()
const router = express.Router()
const kleague = require('./k-league.js')

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
  let response = new chatbotResponse()

  kleague.getMatch('전북', new Date())
  .then(match => {
    response.output(kleague.matchToString(match), [
      {
        "action": "block",
        "label": "라인업",
        "blockId": "5d7d48eeffa7480001c23697"
      }, {
        "action": "block",
        "label": "심판",
        "blockId": "5d86b373ffa74800015154be"
      }
    ]).context([{
      "name": "game",
      "lifeSpan": 5,
      "params": {
        "game_id": match.gameid.toString()
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
  let response = new chatbotResponse()

  kleague.getNextMatch('전북', new Date())
  .then(match => {
    response
    .output(kleague.matchToString(match), [])
    .context([{
      "name": "game",
      "lifeSpan": 5,
      "params": {
        "game_id": match.gameid.toString()
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
  let response = new chatbotResponse()

  kleague.getLastMatch('전북', new Date())
  .then(match => {
    response.output(kleague.matchToString(match), [
      {
        "action": "block",
        "label": "라인업",
        "blockId": "5d7d48eeffa7480001c23697"
      }, {
        "action": "block",
        "label": "심판",
        "blockId": "5d86b373ffa74800015154be"
      }
    ]).context([{
      "name": "game",
      "lifeSpan": 5,
      "params": {
        "game_id": match.gameid.toString()
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
  const gameId = req.body.action.params.game_id
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = new chatbotResponse()
  
  kleague.getLineUp('전북', matchYear, gameId)
  .then(lineup => response.output(kleague.lineUpToString(lineup)))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.output('어떤 경기에 대해 물어 보셨는지 모르겠어요.')
        break
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

router.all('/matches/:game_id/lineup', (req, res) => {
  const gameId = req.params['game_id']
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = new chatbotResponse()

  kleague.getLineUp('전북', matchYear, gameId)
  .then(lineup => response.output(kleague.lineUpToString(lineup)))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.output('어떤 경기에 대해 물어 보셨는지 모르겠어요.')
        break
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

router.all('/referees', (req, res) => {
  const gameId = req.body.action.params.game_id
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = new chatbotResponse()
  
  kleague.getReferees(matchYear, gameId)
  .then(referees => response.output(referees))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.output('어떤 경기에 대해 물어 보셨는지 모르겠어요.')
        break
      case 'no_referees':
        response.output('심판이 공개되지 않았습니다.')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/matches/:game_id/referees', (req, res) => {
  const gameId = req.params['game_id']
  const koreanMatchDate = moment((new Date()).getTime()).tz("Asia/Seoul")
  const matchYear = koreanMatchDate.format("YYYY")
  let response = new chatbotResponse()

  kleague.getReferees(matchYear, gameId)
  .then(referees => response.output(referees))
  .catch(reason => {
    switch(reason){
      case 'no_game_id':
        response.output('어떤 경기에 대해 물어 보셨는지 모르겠어요.')
        break
      case 'no_referees':
        response.output('심판이 공개되지 않았습니다.')
        break
      default :
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

router.all('/ranking/:league', (req, res) => {
  const leagueNum = req.params['league']
  let response = new chatbotResponse()

  kleague.getRanking(leagueNum, new Date())
  .then(ranking => response.output(kleague.rankingToString(leagueNum, ranking)))
  .catch(reason => {
    switch(reason){
      default :
        console.log('Error: ', reason)
        response.output('현재 챗봇이 정상 작동하지 않습니다. 잠시후 다시 시도해 주세요.')
    }
  })
  .finally(() => {
    res.status(200).send(response.toBody())
  })
})

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
