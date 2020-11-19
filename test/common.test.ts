import { QueueDef } from '@/common'

describe('common', () => {
  describe('QueueDef', () => {
    it.each([
      [[{from: 'q1.pre', to: 'q1.up'}], true],
      [[{from: 'q1.pre', to: 'q1.up'}, {from: 'q2.pre', to: 'q2.up'}], true],
      [[{from: 'q1.pre', to: 'q1.up', template: 't'}, {from: 'q2.pre', to: 'q2.up', schema: 's'}], true],
      [[{from: 'q1.pre', to: 'q1.up'}, {from: 'q2.pre', schema: 'bar'}], false],
      [[{to: 'q1.up'}, {from: 'q2.pre', to: 'q2.up', schema: 'bar'}], false],
      [[], true],
      [[0], false],
      [['q1.pre'], false],
      [[{}], false],
      [[{foo: 'bar'}], false],
      [{}, false],
      [null, false],
      ['from', false],
      [0, false],
    ])('QueueDef.isQueueDefs(%o) = %s', (x, result) => {
      expect(QueueDef.isQueueDefs(x)).toBe(result)
    })

    describe('QueueDef.parseJson', () => {
      it.each([
        ['[{"from": "q1.pre", "to": "q1.up"}]', [new QueueDef('q1.pre', 'q1.up')]],
        ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json"}]', [new QueueDef('q1.pre', 'q1.up', 'schema.json')]],
        ['[{"from": "q1.pre", "to": "q1.up", "template": "template.json"}]', [new QueueDef('q1.pre', 'q1.up', '', 'template.json')]],
        ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json", "template": "template.json"}]',
         [new QueueDef('q1.pre', 'q1.up', 'schema.json', 'template.json')]],
        ['[{"from": "q1.pre", "to": "q1.up"}, {"from": "q2.pre", "to": "q2.up"}]', [new QueueDef('q1.pre', 'q1.up'), new QueueDef('q2.pre', 'q2.up')]],
      ])('is success(%s) = %o', (s, result) => {
        expect(QueueDef.parseJson(s)).toMatchObject(result)
      })

      it.each([
        ['[{"from": "q1.pre", "to": "q1.up"}'],
        ['[{"from": "q1.pre", "schema": "schema.json"}]'],
        ['[{"to": "q1.up", "schema": "schema.json"}]'],
        ['[{"from": "q1.pre", "to": "q1.up"}, {"from": "q2.pre"}]'],
      ])('is failed(%s) and throw error', s => {
        expect(() => {
          QueueDef.parseJson(s)
        }).toThrow()
      })
    })
  })
})
