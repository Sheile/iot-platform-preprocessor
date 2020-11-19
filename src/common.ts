export class QueueDef {
  constructor(public from: string, public to: string, public schema: string = '', public template: string = '') {
  }

  static isQueueDefs(x: unknown): boolean {
    return Array.isArray(x) && x.every(e => (typeof e === 'object') && 'from' in e && 'to' in e)
  }

  static parseJson(json: string): QueueDef[] {
    const queueDefs = JSON.parse(json)
    if (!QueueDef.isQueueDefs(queueDefs)) {
      throw new Error()
    }

    return queueDefs.map((e: {from: string; to: string; schema: string | undefined; template: string | undefined}) => {
      return new QueueDef(e.from, e.to, e.schema, e.template)
    })
  }
}
