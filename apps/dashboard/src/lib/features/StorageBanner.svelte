<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
</script>

<div class="storage-privacy">
  <Icon name="shield" size={24} />
  <div>
    <strong>File isolation enforced by design</strong>
    <p>
      Object storage operates on buckets and object keys only. Application
      releases are read-only; persistent volumes are allocated separately. There
      is no host filesystem browsing, SSH, Docker socket, or VPS root access
      through this interface.
    </p>
  </div>
</div>
