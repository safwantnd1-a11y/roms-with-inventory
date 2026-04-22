# Firebase Dashboard Settings for Restaurant Management System

## Firebase Storage Note
This project no longer requires Firebase Storage or image uploads for menu items.

The app now supports menu creation without any image field, so you can ignore previous Firebase setup instructions.

## Current behavior
- Menu items are created with name, category, description, preparation time, and stock only.
- No image upload is required.
- No Firebase Storage configuration is needed for the menu feature.

## If you want to keep Firebase integration later
You can leave the old `firebase.ts`, `src/hooks/useStorage.ts`, and `src/utils/storage.ts` files unused, or remove them if you prefer.

## Important note
Since images are no longer required, any existing image-related fields will be ignored by the new backend menu API.