# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-03

### Added

- Right side panel (`Panel`, `region: "side"`) that shows pending question forms instead of the bottom dock
- Automatic open and selection when a question arrives, with a per-form "closed by the user" fallback to the dock
- All questions of a form in one expanded vertical list, with `n of N answered` progress and per-question marks
- Single choice, multi choice, option descriptions, custom answers and free-text questions
- Queue of pending forms across the routed session and its running subagents, labelled with their source session
- Hides the host's bottom question dock only while the panel is visible; restores it when the panel is closed, the side region is hidden, the session changes or the window narrows below 768px
- Chinese and English copy following the app locale
- Unit tests for the session tree walk, field extraction and answer building
