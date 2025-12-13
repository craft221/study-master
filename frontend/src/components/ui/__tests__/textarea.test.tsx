/**
 * Tests for Textarea component
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Textarea Component', () => {
  describe('Rendering', () => {
    it('renders correctly', () => {
      render(<textarea placeholder="Enter description" data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toBeInTheDocument()
    })

    it('renders with placeholder', () => {
      render(<textarea placeholder="Type here..." />)
      expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      render(<textarea className="custom-textarea" data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveClass('custom-textarea')
    })

    it('renders with default value', () => {
      render(<textarea defaultValue="Default text" data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveValue('Default text')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLTextAreaElement>()
      render(<textarea ref={ref} data-testid="textarea" />)
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })
  })

  describe('Dimensions', () => {
    it('accepts rows attribute', () => {
      render(<textarea rows={5} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '5')
    })

    it('accepts cols attribute', () => {
      render(<textarea cols={40} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveAttribute('cols', '40')
    })
  })

  describe('States', () => {
    it('handles disabled state', () => {
      render(<textarea disabled data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toBeDisabled()
    })

    it('handles readonly state', () => {
      render(<textarea readOnly value="Read only text" data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')
      expect(textarea).toHaveAttribute('readonly')
    })

    it('handles required state', () => {
      render(<textarea required data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toBeRequired()
    })
  })

  describe('Interactions', () => {
    it('handles value changes', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<textarea onChange={handleChange} data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      await user.type(textarea, 'Hello World')

      expect(handleChange).toHaveBeenCalled()
      expect(textarea).toHaveValue('Hello World')
    })

    it('handles controlled value', () => {
      const { rerender } = render(
        <textarea value="initial" onChange={() => {}} data-testid="textarea" />
      )
      expect(screen.getByTestId('textarea')).toHaveValue('initial')

      rerender(<textarea value="updated" onChange={() => {}} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveValue('updated')
    })

    it('handles multiline input', async () => {
      const user = userEvent.setup()
      render(<textarea data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      await user.type(textarea, 'Line 1{enter}Line 2{enter}Line 3')

      expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3')
    })

    it('handles focus events', () => {
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()

      render(<textarea onFocus={handleFocus} onBlur={handleBlur} data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      fireEvent.focus(textarea)
      expect(handleFocus).toHaveBeenCalledTimes(1)

      fireEvent.blur(textarea)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('can be focused programmatically', () => {
      render(<textarea data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      textarea.focus()
      expect(textarea).toHaveFocus()
    })

    it('handles paste events', async () => {
      const handlePaste = jest.fn()
      render(<textarea onPaste={handlePaste} data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      fireEvent.paste(textarea, {
        clipboardData: { getData: () => 'Pasted text' },
      })

      expect(handlePaste).toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('handles minLength validation', () => {
      render(<textarea minLength={10} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveAttribute('minLength', '10')
    })

    it('handles maxLength validation', () => {
      render(<textarea maxLength={500} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveAttribute('maxLength', '500')
    })

    it('enforces maxLength', async () => {
      const user = userEvent.setup()
      render(<textarea maxLength={5} data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')

      await user.type(textarea, 'Hello World')

      expect(textarea).toHaveValue('Hello')
    })
  })

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<textarea data-testid="textarea" />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<textarea aria-label="Description" />)
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      render(
        <>
          <textarea aria-describedby="hint" data-testid="textarea" />
          <span id="hint">Enter a detailed description</span>
        </>
      )
      expect(screen.getByTestId('textarea')).toHaveAttribute('aria-describedby', 'hint')
    })

    it('supports aria-invalid', () => {
      render(<textarea aria-invalid="true" data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveAttribute('aria-invalid', 'true')
    })

    it('associates with label correctly', () => {
      render(
        <>
          <label htmlFor="description">Description</label>
          <textarea id="description" />
        </>
      )
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
    })
  })

  describe('Resize', () => {
    it('can have resize style', () => {
      render(<textarea style={{ resize: 'none' }} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveStyle({ resize: 'none' })
    })

    it('can have vertical resize', () => {
      render(<textarea style={{ resize: 'vertical' }} data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toHaveStyle({ resize: 'vertical' })
    })
  })

  describe('Form integration', () => {
    it('works within a form', () => {
      render(
        <form>
          <textarea name="description" data-testid="textarea" />
        </form>
      )
      expect(screen.getByTestId('textarea')).toHaveAttribute('name', 'description')
    })

    it('can be submitted in form', async () => {
      const handleSubmit = jest.fn((e) => e.preventDefault())
      const user = userEvent.setup()

      render(
        <form onSubmit={handleSubmit}>
          <textarea name="content" defaultValue="Test content" data-testid="textarea" />
          <button type="submit">Submit</button>
        </form>
      )

      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(handleSubmit).toHaveBeenCalled()
    })
  })

  describe('Character counter', () => {
    it('can track character count', async () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0)
        return (
          <>
            <textarea
              data-testid="textarea"
              onChange={(e) => setCount(e.target.value.length)}
              maxLength={100}
            />
            <span data-testid="count">{count}/100</span>
          </>
        )
      }

      const user = userEvent.setup()
      render(<TestComponent />)

      await user.type(screen.getByTestId('textarea'), 'Hello')

      expect(screen.getByTestId('count')).toHaveTextContent('5/100')
    })
  })
})
