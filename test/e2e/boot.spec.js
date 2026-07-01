// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { test, expect, _electron as electron } from '@playwright/test'

async function launch() {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win }
}

test('boots to Documents and shows the seeded demo', async () => {
  const { app, win } = await launch()
  await expect(win.getByRole('heading', { name: /your reports/i })).toBeVisible()
  await expect(win.getByText(/sample report/i)).toBeVisible()
  await expect(win.getByText(/thermal runaway/i)).toBeVisible()
  await app.close()
})

test('opens the demo, resolves an item, and the queue count drops', async () => {
  const { app, win } = await launch()
  await win.locator('.doc.demo').first().click()
  // Review workspace
  await expect(win.locator('.q-head')).toContainText(/to resolve/i)
  const before = parseInt(await win.locator('.q-head .big').first().innerText(), 10)
  await win.getByRole('button', { name: /done & next/i }).click()
  // an undo toast confirms the write
  await expect(win.getByText(/marked "done"/i)).toBeVisible()
  const after = parseInt(await win.locator('.q-head .big').first().innerText(), 10)
  expect(after).toBe(before - 1)
  await app.close()
})

test('creates a new document', async () => {
  const { app, win } = await launch()
  await win.getByRole('button', { name: /new report/i }).first().click()
  await win.getByPlaceholder(/andersen/i).fill('E2E Report')
  await win.getByRole('button', { name: /^create$/i }).click()
  // lands on Import for the new document
  await expect(win.getByRole('heading', { name: /add your documents/i })).toBeVisible()
  await app.close()
})
