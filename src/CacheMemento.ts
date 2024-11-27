// CacheMemento.ts
export class CacheMemento {
  constructor(
    public id: string,
    public coins: { id: string; collected: boolean }[],
  ) {}
}
