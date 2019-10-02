'use strict'

exports.response = (msg) => {
  let data = {
    "version": "2.0",
    "template": { "outputs": [] },
    "context": { "values": [] },

    appendOutput: function(output) {
      let item = {}
      item[output.getType()] = output
      this['template']['outputs'].push(item)
      return this
    },

    appendOutputs: function(outputs) {
      outputs.forEach(o => this.appendOutput(o))
      return this
    },

    appendContext: function(context) {
      this['context']['values'].push(context)
      return this
    }
  }

  return data
}

exports.context = (nameStr) => {
  let data = {
    "name": nameStr,
    "lifeSpan": 0,
    "params": {}, 

    setName: function(value) {
      this['name'] = value
      return this
    },

    setLifeSpan: function(value) {
      this['lifeSpan'] = value
      return this
    },

    addParam: function(key, value) {
      this['params'][key] = value
      return this
    }
  }

  return data
}

exports.button = (label) => {
  let data = {
    "label": label,
    "action": "block",

    setAction: function(value) {
      this['action'] = value
      return this
    },

    setBlockId: function(value) {
      this['blockId'] = value
      return this
    },

    setWebLinkUrl: function(value) {
      this['webLinkUrl'] = value
      return this
    }
  }

  return data
}

exports.carousel = (type) => {
  let data = {
    "type": type,
    "items": [],

    getType: () => 'carousel',

    setType: function(value) {
      this['type'] = value
      return this
    },

    appendItem: function(item) {
      this['items'].push(item)
      return this
    },

    appendItems: function(items) {
      items.forEach(i => this['items'].push(i))
      return this
    },
  }

  return data
}

exports.simpleText = (msg) => {
  let data = {
    "text": msg,

    getType: () => 'simpleText',

    setText: function(value) {
      this['text'] = value
      return this
    }
  }

  return data
}

exports.basicCard = (title, description) => {
  let data = {
    "title": title,
    "description": description,
    "buttons": [],

    getType: () => 'basicCard',

    setTitle: function(value) {
      this['title'] = value
      return this
    },

    setDescription: function(value) {
      this['description'] = value
      return this
    },

    appendButton: function(button) {
      this['buttons'].push(button)
      return this
    },

    setImage: function(imageURL, fixedRatio=false, width, height) {
      this['thumbnail'] = {
        'imageUrl': imageURL,
        'fixedRatio': fixedRatio,
        'width': width,
        'height': height
      }
      return this
    }
  }

  return data
}