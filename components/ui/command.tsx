"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import clsx from "clsx"

interface CommandProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive> {
  className?: string
}

/**
 * Main Command root container with some basic styling:
 * - White background
 * - Border
 * - Rounded corners
 * - Shadow
 */
const Root = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive
      ref={ref}
      className={clsx(
        "relative w-full max-w-md rounded border bg-white shadow-sm", 
        "focus-within:shadow-md transition-shadow",
        className
      )}
      {...props}
    />
  )
)
Root.displayName = "Command"

/**
 * Command Input
 * - Simple text input with a bottom border
 * - Padding, text styles
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={clsx(
      "w-full border-b p-2 outline-none text-sm placeholder:text-gray-400",
      "focus:outline-none",
      className
    )}
    {...props}
  />
))
Input.displayName = "CommandInput"

/**
 * Command List
 * - The container for your command items.
 */
const List = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={clsx("max-h-60 overflow-auto", className)}
    {...props}
  />
))
List.displayName = "CommandList"

/**
 * Command Empty
 * - Displayed when there are no matching items
 */
const Empty = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={clsx(
      "p-4 text-sm text-gray-500 text-center",
      className
    )}
    {...props}
  />
))
Empty.displayName = "CommandEmpty"

/**
 * Command Group
 * - Groups command items under a heading
 */
const Group = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={clsx("p-2", className)}
    {...props}
  />
))
Group.displayName = "CommandGroup"

/**
 * Command Item
 * - Each clickable row in the command list
 */
const Item = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={clsx(
      "flex w-full cursor-pointer select-none items-center rounded p-2 text-sm",
      "text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors",
      className
    )}
    {...props}
  >
    {children}
  </CommandPrimitive.Item>
))
Item.displayName = "CommandItem"

/**
 * Export them in the same named format your code expects:
 */
export {
  Root as Command,
  Input as CommandInput,
  List as CommandList,
  Empty as CommandEmpty,
  Group as CommandGroup,
  Item as CommandItem,
}
