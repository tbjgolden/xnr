export class Dolphin {
  name: string;

  constructor(name?: string) {
    this.name = name ?? "Flippers";
  }

  speak() {
    console.log(`click click i am ${this.name.toLowerCase()}`);
  }
}

