import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button component', () => {
  it('renders correctly with default slot', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me'
      }
    })
    expect(wrapper.text()).toBe('Click me')
  })

  it('applies custom classes', () => {
    const wrapper = mount(Button, {
      props: {
        class: 'custom-class'
      }
    })
    expect(wrapper.classes()).toContain('custom-class')
  })

  it('applies variant classes', () => {
    const wrapper = mount(Button, {
      props: {
        variant: 'destructive'
      }
    })
    // Check if it has destructive-related styles from buttonVariants
    expect(wrapper.attributes('class')).toContain('destructive')
  })
})
