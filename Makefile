.PHONY: install dev-setup build test lint clean help

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and build the project
	@echo "Installing dependencies..."
	npm install
	@echo "Building project..."
	npm run build
	@echo "✓ Installation complete"

dev-setup: ## Set up development environment
	@echo "Setting up development environment..."
	npm install
	@echo "Creating config directories..."
	mkdir -p ~/.config/app-repo/{environments,keys}
	@echo "✓ Development environment ready"

build: ## Build TypeScript source
	@echo "Building TypeScript..."
	npm run build
	@echo "✓ Build complete"

test: ## Run test suite
	@echo "Running tests..."
	npm test
	@echo "✓ Tests complete"

lint: ## Run linter
	@echo "Running ESLint..."
	npm run lint
	@echo "✓ Lint complete"

lint-fix: ## Run linter with auto-fix
	@echo "Running ESLint with auto-fix..."
	npm run lint:fix
	@echo "✓ Lint fixes applied"

clean: ## Clean build artifacts and dependencies
	@echo "Cleaning..."
	npm run clean
	rm -rf node_modules
	@echo "✓ Clean complete"

watch: ## Watch TypeScript files for changes
	@echo "Watching for changes..."
	npm run dev

.DEFAULT_GOAL := help
