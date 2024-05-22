#!/usr/bin/env node
import 'dotenv/config'
import { makeCLI } from './cli.js'

makeCLI().parse()
