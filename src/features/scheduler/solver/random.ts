// seedを指定すると同じ実行結果を再現できる、TypeScript版の乱数生成器。
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error("乱数の上限は1以上である必要があります。");
    }
    return Math.floor(this.next() * maxExclusive);
  }

  shuffle<T>(values: T[]): void {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const otherIndex = this.int(index + 1);
      [values[index], values[otherIndex]] = [values[otherIndex], values[index]];
    }
  }
}
