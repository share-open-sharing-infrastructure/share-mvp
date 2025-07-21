<script>
      import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    
    let input;
    let container;
    let item_image;
    let placeholder;
    let showImage = false;
  
    function onChange() {
      const file = input.files[0];
          
      if (file) {
              showImage = true;
  
        const reader = new FileReader();
        reader.addEventListener("load", function () {
          item_image.setAttribute("src", reader.result);
        });

        reader.onload = () => {
        dispatch('imageSelected', { imageDataUrl: reader.result });
        };

        reader.readAsDataURL(file);
        return;

      } 
      showImage = false; 
    }

    export function reset() {
      showImage = false;
      if (input) input.value = '';
    }


  </script>
  
  <input
      bind:this={input}
      on:change={onChange}
    type="file"
  />
  <div bind:this={container}>
      {#if showImage}
          <img bind:this={item_image} src="" alt="Preview" />
      {:else}
          <span bind:this={placeholder}>Bild Vorschau</span>
      {/if}
  </div>
  
  <style>
      div {
      width: 200px;
      min-height: 100px;
      border: 2px solid;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ccc;
    }
    img {
      width: 100%;
    }
  </style>
  

