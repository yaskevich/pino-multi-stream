'use strict'

var writeStream = require('flush-write-stream')
var test = require('tap').test
var pino = require('pino')
var multistream = require('../').multistream

test('sends to multiple streams using string levels', function (t) {
  var messageCount = 0
  var stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  var streams = [
    { stream: stream },
    { level: 'debug', stream: stream },
    { level: 'trace', stream: stream },
    { level: 'fatal', stream: stream },
    { level: 'silent', stream: stream }
  ]
  var log = pino({
    level: 'trace'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  t.is(messageCount, 9)
  t.done()
})

test('sends to multiple streams using number levels', function (t) {
  var messageCount = 0
  var stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  var streams = [
    { stream: stream },
    { level: 20, stream: stream },
    { level: 60, stream: stream }
  ]
  var log = pino({
    level: 'debug'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  t.is(messageCount, 6)
  t.done()
})

test('level include higher levels', function (t) {
  var messageCount = 0
  var stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  var log = pino({}, multistream([{ level: 'info', stream: stream }]))
  log.fatal('message')
  t.is(messageCount, 1)
  t.done()
})

test('supports multiple arguments', function (t) {
  var messages = []
  var stream = writeStream(function (data, enc, cb) {
    messages.push(JSON.parse(data))
    if (messages.length === 2) {
      var msg1 = messages[0]
      t.is(msg1.msg, 'foo bar baz foobar')

      var msg2 = messages[1]
      t.is(msg2.msg, 'foo bar baz foobar barfoo foofoo')

      t.done()
    }
    cb()
  })
  var log = pino({}, multistream({ stream }))
  log.info('%s %s %s %s', 'foo', 'bar', 'baz', 'foobar') // apply not invoked
  log.info('%s %s %s %s %s %s', 'foo', 'bar', 'baz', 'foobar', 'barfoo', 'foofoo') // apply invoked
})

test('supports children', function (t) {
  var stream = writeStream(function (data, enc, cb) {
    var input = JSON.parse(data)
    t.is(input.msg, 'child stream')
    t.is(input.child, 'one')
    t.done()
    cb()
  })
  var streams = [
    { stream: stream }
  ]
  var log = pino({}, multistream(streams)).child({ child: 'one' })
  log.info('child stream')
})

test('supports grandchildren', function (t) {
  var messages = []
  var stream = writeStream(function (data, enc, cb) {
    messages.push(JSON.parse(data))
    if (messages.length === 3) {
      var msg1 = messages[0]
      t.is(msg1.msg, 'grandchild stream')
      t.is(msg1.child, 'one')
      t.is(msg1.grandchild, 'two')

      var msg2 = messages[1]
      t.is(msg2.msg, 'grandchild stream')
      t.is(msg2.child, 'one')
      t.is(msg2.grandchild, 'two')

      var msg3 = messages[2]
      t.is(msg3.msg, 'debug grandchild')
      t.is(msg3.child, 'one')
      t.is(msg3.grandchild, 'two')

      t.done()
    }
    cb()
  })
  var streams = [
    { stream: stream },
    { level: 'debug', stream: stream }
  ]
  var log = pino({
    level: 'debug'
  }, multistream(streams)).child({ child: 'one' }).child({ grandchild: 'two' })
  log.info('grandchild stream')
  log.debug('debug grandchild')
})

test('supports custom levels', function (t) {
  var stream = writeStream(function (data, enc, cb) {
    t.is(JSON.parse(data).msg, 'bar')
    t.done()
  })
  var log = pino({
    customLevels: {
      foo: 35
    }
  }, multistream([{ level: 35, stream: stream }]))
  log.foo('bar')
})

test('supports pretty print', function (t) {
  var stream = writeStream(function (data, enc, cb) {
    t.isNot(data.toString().match(/INFO.*: pretty print/), null)
    t.done()
    cb()
  })
  var outStream = pino({
    prettyPrint: {
      levelFirst: true,
      colorize: false
    }
  }, stream)

  var log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream([
    { stream: outStream[pino.symbols.streamSym] }
  ]))

  log.info('pretty print')
})

test('children support custom levels', function (t) {
  var stream = writeStream(function (data, enc, cb) {
    t.is(JSON.parse(data).msg, 'bar')
    t.done()
  })
  var parent = pino({
    customLevels: {
      foo: 35
    }
  }, multistream([{ level: 35, stream: stream }]))
  var child = parent.child({ child: 'yes' })
  child.foo('bar')
})

test('levelVal ovverides level', function (t) {
  var messageCount = 0
  var stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  var streams = [
    { stream: stream },
    { level: 'blabla', levelVal: 15, stream: stream },
    { level: 60, stream: stream }
  ]
  var log = pino({
    level: 'debug'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  t.is(messageCount, 6)
  t.done()
})

test('forwards metadata', function (t) {
  t.plan(4)
  var streams = [
    {
      stream: {
        [Symbol.for('pino.metadata')]: true,
        write (chunk) {
          t.equal(log, this.lastLogger)
          t.equal(30, this.lastLevel)
          t.equal('a msg', this.lastMsg)
          t.deepEqual({ hello: 'world', msg: 'a msg' }, this.lastObj)
        }
      }
    }
  ]

  var log = pino({
    level: 'debug'
  }, multistream(streams))

  log.info({ hello: 'world' }, 'a msg')
  t.done()
})

test('forward name', function (t) {
  t.plan(2)
  var streams = [
    {
      stream: {
        [Symbol.for('pino.metadata')]: true,
        write (chunk) {
          const line = JSON.parse(chunk)
          t.equal(line.name, 'helloName')
          t.equal(line.hello, 'world')
        }
      }
    }
  ]

  var log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream(streams))

  log.info({ hello: 'world' }, 'a msg')
  t.done()
})

test('forward name with child', function (t) {
  t.plan(3)
  var streams = [
    {
      stream: {
        write (chunk) {
          const line = JSON.parse(chunk)
          t.equal(line.name, 'helloName')
          t.equal(line.hello, 'world')
          t.equal(line.component, 'aComponent')
        }
      }
    }
  ]

  var log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream(streams)).child({ component: 'aComponent' })

  log.info({ hello: 'world' }, 'a msg')
  t.done()
})

test('clone generates a new multistream with all stream at the same level', function (t) {
  var messageCount = 0
  var stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  var streams = [
    { stream: stream },
    { level: 'debug', stream: stream },
    { level: 'trace', stream: stream },
    { level: 'fatal', stream: stream }
  ]
  var ms = multistream(streams)
  var clone = ms.clone(30)

  t.notEqual(clone, ms)

  clone.streams.forEach((s, i) => {
    t.notEqual(s, streams[i])
    t.equal(s.stream, streams[i].stream)
    t.equal(s.level, 30)
  })

  var log = pino({
    level: 'trace'
  }, clone)

  log.info('info stream')
  log.debug('debug message not counted')
  log.fatal('fatal stream')
  t.is(messageCount, 8)

  t.done()
})
