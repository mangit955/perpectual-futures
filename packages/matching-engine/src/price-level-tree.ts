export interface PriceLevelLike {
  priceTicks: number;
}

interface TreapNode<T extends PriceLevelLike> {
  priceTicks: number;
  priority: number;
  value: T;
  left?: TreapNode<T>;
  right?: TreapNode<T>;
}

export class PriceLevelTree<T extends PriceLevelLike> {
  private readonly levelsByPrice = new Map<number, T>();
  private root?: TreapNode<T>;

  constructor(private readonly bestSide: "min" | "max") {}

  get size(): number {
    return this.levelsByPrice.size;
  }

  get(priceTicks: number): T | undefined {
    return this.levelsByPrice.get(priceTicks);
  }

  set(level: T): void {
    const existing = this.levelsByPrice.get(level.priceTicks);

    if (existing) {
      this.levelsByPrice.set(level.priceTicks, level);
      this.root = this.replace(this.root, level);
      return;
    }

    this.levelsByPrice.set(level.priceTicks, level);
    this.root = this.insert(this.root, {
      priceTicks: level.priceTicks,
      priority: priorityForPrice(level.priceTicks),
      value: level,
    });
  }

  delete(priceTicks: number): T | undefined {
    const existing = this.levelsByPrice.get(priceTicks);

    if (!existing) {
      return undefined;
    }

    this.levelsByPrice.delete(priceTicks);
    this.root = this.remove(this.root, priceTicks);
    return existing;
  }

  best(): T | undefined {
    let node = this.root;

    if (!node) {
      return undefined;
    }

    if (this.bestSide === "min") {
      while (node.left) {
        node = node.left;
      }

      return node.value;
    }

    while (node.right) {
      node = node.right;
    }

    return node.value;
  }

  valuesBestFirst(limit?: number): T[] {
    const values: T[] = [];
    const visit =
      this.bestSide === "min"
        ? this.visitAscending.bind(this)
        : this.visitDescending.bind(this);

    visit(this.root, values, limit);
    return values;
  }

  private insert(
    node: TreapNode<T> | undefined,
    newNode: TreapNode<T>,
  ): TreapNode<T> {
    if (!node) {
      return newNode;
    }

    if (newNode.priceTicks < node.priceTicks) {
      node.left = this.insert(node.left, newNode);

      if (node.left.priority < node.priority) {
        return rotateRight(node);
      }
    } else if (newNode.priceTicks > node.priceTicks) {
      node.right = this.insert(node.right, newNode);

      if (node.right.priority < node.priority) {
        return rotateLeft(node);
      }
    } else {
      node.value = newNode.value;
    }

    return node;
  }

  private replace(
    node: TreapNode<T> | undefined,
    level: T,
  ): TreapNode<T> | undefined {
    if (!node) {
      return undefined;
    }

    if (level.priceTicks < node.priceTicks) {
      node.left = this.replace(node.left, level);
    } else if (level.priceTicks > node.priceTicks) {
      node.right = this.replace(node.right, level);
    } else {
      node.value = level;
    }

    return node;
  }

  private remove(
    node: TreapNode<T> | undefined,
    priceTicks: number,
  ): TreapNode<T> | undefined {
    if (!node) {
      return undefined;
    }

    if (priceTicks < node.priceTicks) {
      node.left = this.remove(node.left, priceTicks);
      return node;
    }

    if (priceTicks > node.priceTicks) {
      node.right = this.remove(node.right, priceTicks);
      return node;
    }

    if (!node.left) {
      return node.right;
    }

    if (!node.right) {
      return node.left;
    }

    if (node.left.priority < node.right.priority) {
      const rotated = rotateRight(node);
      rotated.right = this.remove(rotated.right, priceTicks);
      return rotated;
    }

    const rotated = rotateLeft(node);
    rotated.left = this.remove(rotated.left, priceTicks);
    return rotated;
  }

  private visitAscending(
    node: TreapNode<T> | undefined,
    values: T[],
    limit?: number,
  ): void {
    if (!node || (limit !== undefined && values.length >= limit)) {
      return;
    }

    this.visitAscending(node.left, values, limit);

    if (limit === undefined || values.length < limit) {
      values.push(node.value);
    }

    this.visitAscending(node.right, values, limit);
  }

  private visitDescending(
    node: TreapNode<T> | undefined,
    values: T[],
    limit?: number,
  ): void {
    if (!node || (limit !== undefined && values.length >= limit)) {
      return;
    }

    this.visitDescending(node.right, values, limit);

    if (limit === undefined || values.length < limit) {
      values.push(node.value);
    }

    this.visitDescending(node.left, values, limit);
  }
}

function rotateLeft<T extends PriceLevelLike>(
  node: TreapNode<T>,
): TreapNode<T> {
  const right = node.right;

  if (!right) {
    return node;
  }

  node.right = right.left;
  right.left = node;
  return right;
}

function rotateRight<T extends PriceLevelLike>(
  node: TreapNode<T>,
): TreapNode<T> {
  const left = node.left;

  if (!left) {
    return node;
  }

  node.left = left.right;
  left.right = node;
  return left;
}

function priorityForPrice(priceTicks: number): number {
  let value = priceTicks >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}
