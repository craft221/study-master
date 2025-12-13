/**
 * Tests for Checkbox component
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Checkbox Component', () => {
  describe('Rendering', () => {
    it('renders unchecked by default', () => {
      render(<input type="checkbox" data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).not.toBeChecked()
    })

    it('renders checked when defaultChecked', () => {
      render(<input type="checkbox" defaultChecked data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('renders with label', () => {
      render(
        <label>
          <input type="checkbox" data-testid="checkbox" />
          Accept terms
        </label>
      )
      expect(screen.getByText('Accept terms')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      render(<input type="checkbox" className="custom-checkbox" data-testid="checkbox" />)
      expect(screen.getByTestId('checkbox')).toHaveClass('custom-checkbox')
    })
  })

  describe('States', () => {
    it('handles checked state', () => {
      const { rerender } = render(
        <input type="checkbox" checked={false} onChange={() => {}} data-testid="checkbox" />
      )
      expect(screen.getByTestId('checkbox')).not.toBeChecked()

      rerender(<input type="checkbox" checked={true} onChange={() => {}} data-testid="checkbox" />)
      expect(screen.getByTestId('checkbox')).toBeChecked()
    })

    it('handles disabled state', () => {
      render(<input type="checkbox" disabled data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toBeDisabled()
    })

    it('handles indeterminate state', () => {
      render(<input type="checkbox" ref={(el) => el && (el.indeterminate = true)} data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox') as HTMLInputElement
      expect(checkbox.indeterminate).toBe(true)
    })
  })

  describe('Interactions', () => {
    it('toggles on click', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<input type="checkbox" onChange={handleChange} data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')

      await user.click(checkbox)

      expect(handleChange).toHaveBeenCalledTimes(1)
      expect(checkbox).toBeChecked()
    })

    it('toggles off when already checked', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<input type="checkbox" defaultChecked onChange={handleChange} data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')

      expect(checkbox).toBeChecked()
      await user.click(checkbox)

      expect(handleChange).toHaveBeenCalledTimes(1)
      expect(checkbox).not.toBeChecked()
    })

    it('does not toggle when disabled', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<input type="checkbox" disabled onChange={handleChange} data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')

      await user.click(checkbox)

      expect(handleChange).not.toHaveBeenCalled()
      expect(checkbox).not.toBeChecked()
    })

    it('toggles with keyboard (Space)', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(<input type="checkbox" onChange={handleChange} data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')

      checkbox.focus()
      await user.keyboard(' ')

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('can be focused', () => {
      render(<input type="checkbox" data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')

      checkbox.focus()
      expect(checkbox).toHaveFocus()
    })
  })

  describe('Form integration', () => {
    it('has correct value in form', () => {
      render(
        <form>
          <input type="checkbox" name="terms" value="accepted" data-testid="checkbox" />
        </form>
      )
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toHaveAttribute('name', 'terms')
      expect(checkbox).toHaveAttribute('value', 'accepted')
    })

    it('handles required validation', () => {
      render(<input type="checkbox" required data-testid="checkbox" />)
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toBeRequired()
    })
  })

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<input type="checkbox" data-testid="checkbox" />)
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<input type="checkbox" aria-label="Accept newsletter" />)
      expect(screen.getByLabelText('Accept newsletter')).toBeInTheDocument()
    })

    it('supports aria-labelledby', () => {
      render(
        <>
          <span id="checkbox-label">Terms and Conditions</span>
          <input type="checkbox" aria-labelledby="checkbox-label" data-testid="checkbox" />
        </>
      )
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toHaveAttribute('aria-labelledby', 'checkbox-label')
    })

    it('supports aria-describedby', () => {
      render(
        <>
          <input type="checkbox" aria-describedby="desc" data-testid="checkbox" />
          <span id="desc">By checking this, you agree to our terms</span>
        </>
      )
      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toHaveAttribute('aria-describedby', 'desc')
    })

    it('associates with htmlFor label', () => {
      render(
        <>
          <label htmlFor="agree-checkbox">I agree</label>
          <input type="checkbox" id="agree-checkbox" />
        </>
      )
      expect(screen.getByLabelText('I agree')).toBeInTheDocument()
    })

    it('clicking label toggles checkbox', async () => {
      const user = userEvent.setup()
      render(
        <label>
          <input type="checkbox" data-testid="checkbox" />
          Accept
        </label>
      )

      await user.click(screen.getByText('Accept'))
      expect(screen.getByTestId('checkbox')).toBeChecked()
    })
  })

  describe('Checkbox Group', () => {
    it('handles multiple checkboxes independently', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <label>
            <input type="checkbox" name="options" value="a" data-testid="checkbox-a" />
            Option A
          </label>
          <label>
            <input type="checkbox" name="options" value="b" data-testid="checkbox-b" />
            Option B
          </label>
          <label>
            <input type="checkbox" name="options" value="c" data-testid="checkbox-c" />
            Option C
          </label>
        </div>
      )

      const checkboxA = screen.getByTestId('checkbox-a')
      const checkboxB = screen.getByTestId('checkbox-b')
      const checkboxC = screen.getByTestId('checkbox-c')

      await user.click(checkboxA)
      await user.click(checkboxC)

      expect(checkboxA).toBeChecked()
      expect(checkboxB).not.toBeChecked()
      expect(checkboxC).toBeChecked()
    })
  })
})
