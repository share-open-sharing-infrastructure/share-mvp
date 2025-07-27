<script>

let item_name = '';
let item_description = '';
let item_image;
let items = [];

let input;
let container;
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

    reader.readAsDataURL(file);
            return;
    } 
        showImage = false; 
}


function addItem() {
    if (item_name && item_description && item_image) {
        items = [...items, { item_name, item_description, item_image  }];
        item_name = '';
        item_description = '';
        console.log(items);
    }
    else(
        console.log("error")
    )
}


</script>



<h1>Gegenstände</h1>


<h2> Neuen Gegenstand hinzuƒügen</h2>

  
  <input
      bind:this={input}
      onchange={onChange}
    type="file" 
  />
  
  <div class="container" bind:this={container}>
      {#if showImage}
          <img bind:this={item_image} src="" alt="Preview" />
      {:else}
          <span bind:this={placeholder}>Bild Vorschau</span>
      {/if}
  </div>


<p><input type="text" bind:value={item_name} placeholder="Name des Gegenstands" />   </p>
<p><input type="text" bind:value={item_description} placeholder="Beschreibung des Gegenstands" /> </p>


<p><button onclick={addItem}>Gegenstand hinzufügen</button></p>


<h2> Liste </h2>

{#each items as item}
    <div>

        <h3>{item.item_name}</h3>
        <img class="preview-img" src={item.item_image.currentSrc} alt="" />
        <p>{item.item_description}</p>

    </div>
{/each}


  
  <style>
      .container {
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
    .preview-img {
        width: 150px;
        min-height: 50px;
    }
  </style>
  
