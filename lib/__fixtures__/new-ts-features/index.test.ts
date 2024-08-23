#!/usr/bin/env node
import { Dolphin } from ".";

export const test = () => {
  new Dolphin("Lorenzo").speak();
};

test();
