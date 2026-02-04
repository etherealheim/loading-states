# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An experimental Next.js project exploring animated loaders using motion.dev (Framer Motion). The project features a 5x5 grid canvas that renders different dot states (full, half, empty) and animates shapes like circles and arrows across the grid.

## Development Commands

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
```

## Architecture

### Loader Concept

The loader is a 5x5 grid canvas with three rectangle states:
- **Full state**: 2x2px black rectangle (the actual shape)
- **Half state**: 2x2px rectangle with 0.5px grey inside border (nearest neighbors)
- **Empty state**: 1x1px grey rectangle (rest of the grid)

The animation logic:
1. The actual shape uses full state
2. Nearest neighbors to the shape use half state
3. All other grid positions use empty state

## Skills

Use the following skills for specific workflows in this project:

- **vercel-react-best-practices**: Apply React and Next.js performance optimization guidelines from Vercel Engineering when writing, reviewing, or refactoring React/Next.js code. Use for component design, data fetching patterns, and bundle optimization.

- **frontend-design**: Use for UI/UX implementation guidance, design system patterns, and frontend architecture decisions.

- **motion.dev**: Use when implementing animations and motion effects. Consult for best practices with motion libraries and animation patterns.

- **docs**: Use to fetch and reference official documentation for libraries and frameworks being used in the project. Helpful for API references and getting up-to-date implementation examples.
