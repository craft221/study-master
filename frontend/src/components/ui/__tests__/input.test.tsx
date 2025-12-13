/**
 * Tests for Input component
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders correctly', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      render(<Input className="custom-class" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('custom-class')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('renders with default styles', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md')
    })
  })

  describe('Types', () => {
    it('renders text input by default', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      // Browser defaults to text if no type specified
      expect(input.getAttribute('type') ?? 'text').toBe('text')
    })

    it('renders email input', () => {
      render(<Input type="email" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('renders password input', () => {
      render(<Input type="password" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('renders number input', () => {
      render(<Input type="number" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('renders search input', () => {
      render(<Input type="search" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('type', 'search')
    })

    it('renders file input', () => {
      render(<Input type="file" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('type', 'file')
    })
  })

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Input disabled data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    })

    it('handles readonly state', () => {
      render(<Input readOnly value="readonly" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('readonly')
    })

    it('handles required state', () => {
      render(<Input required data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toBeRequired()
    })
  })

  describe('Interactions', () => {
    it('handles value changes', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<Input onChange={handleChange} data-testid="input" />)
      const input = screen.getByTestId('input')

      await user.type(input, 'hello')

      expect(handleChange).toHaveBeenCalled()
      expect(input).toHaveValue('hello')
    })

    it('handles controlled value', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} data-testid="input" />)
      const input = screen.getByTestId('input')

      expect(input).toHaveValue('initial')

      rerender(<Input value="updated" onChange={() => {}} data-testid="input" />)
      expect(input).toHaveValue('updated')
    })

    it('handles focus events', () => {
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()

      render(<Input onFocus={handleFocus} onBlur={handleBlur} data-testid="input" />)
      const input = screen.getByTestId('input')

      fireEvent.focus(input)
      expect(handleFocus).toHaveBeenCalledTimes(1)

      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('handles keyboard events', async () => {
      const handleKeyDown = jest.fn()
      const handleKeyUp = jest.fn()
      const user = userEvent.setup()

      render(<Input onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} data-testid="input" />)
      const input = screen.getByTestId('input')

      await user.type(input, 'a')

      expect(handleKeyDown).toHaveBeenCalled()
      expect(handleKeyUp).toHaveBeenCalled()
    })

    it('can be focused programmatically', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')

      input.focus()
      expect(input).toHaveFocus()
    })
  })

  describe('Validation', () => {
    it('handles minLength validation', () => {
      render(<Input minLength={3} data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('minLength', '3')
    })

    it('handles maxLength validation', () => {
      render(<Input maxLength={10} data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('handles pattern validation', () => {
      render(<Input pattern="[0-9]+" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('pattern', '[0-9]+')
    })

    it('handles min/max for number inputs', () => {
      render(<Input type="number" min={0} max={100} data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
    })
  })

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<Input data-testid="input" />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Username" />)
      expect(screen.getByLabelText('Username')).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      render(
        <>
          <Input aria-describedby="hint" data-testid="input" />
          <span id="hint">Enter your username</span>
        </>
      )
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('aria-describedby', 'hint')
    })

    it('supports aria-invalid', () => {
      render(<Input aria-invalid="true" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('associates with label correctly', () => {
      render(
        <>
          <label htmlFor="email-input">Email</label>
          <Input id="email-input" />
        </>
      )
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('has focus-visible styles', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
    })
  })

  describe('Placeholder', () => {
    it('renders placeholder text', () => {
      render(<Input placeholder="Enter your email" />)
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    })

    it('has placeholder styles', () => {
      render(<Input placeholder="Placeholder" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('placeholder:text-muted-foreground')
    })
  })

  describe('Name and ID', () => {
    it('accepts name attribute', () => {
      render(<Input name="email" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('name', 'email')
    })

    it('accepts id attribute', () => {
      render(<Input id="email-input" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('id', 'email-input')
    })
  })

  describe('Autocomplete', () => {
    it('supports autocomplete attribute', () => {
      render(<Input autoComplete="email" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('autocomplete', 'email')
    })

    it('can disable autocomplete', () => {
      render(<Input autoComplete="off" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('autocomplete', 'off')
    })
  })
})
